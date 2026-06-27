using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Domain;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/mercadopago")]
    public class MercadoPagoController : ControllerBase
    {
        private readonly IMercadoPagoService _mercadoPagoService;
        private readonly ApplicationDbContext _context;
        private readonly HttpClient _httpClient;

        public MercadoPagoController(IMercadoPagoService mercadoPagoService, ApplicationDbContext context, HttpClient httpClient)
        {
            _mercadoPagoService = mercadoPagoService;
            _context = context;
            _httpClient = httpClient;
        }

        [HttpPost("intent")]
        public async Task<IActionResult> CreateIntent([FromBody] CreateIntentRequest request)
        {
            try
            {
                // Si viene asignación de cobro, la persistimos en SystemSettings
                if (request.RentAllocations != null || request.ConsumptionAllocations != null || request.PreviousDebt > 0 || request.DirectSalePayload != null)
                {
                    string actualReference = request.ReferenceId;
                    if (request.ReferenceId.Contains(";"))
                    {
                        actualReference = request.ReferenceId.Split(';')[0];
                    }
                    if (actualReference.Length > 2)
                    {
                        var bookingIdStr = actualReference.Substring(2);
                        var key = $"MP_Alloc_{bookingIdStr}";
                        string allocationJson = "";
                        
                        if (actualReference.StartsWith("D-"))
                        {
                            allocationJson = JsonSerializer.Serialize(new
                            {
                                DirectSalePayload = request.DirectSalePayload
                            });
                        }
                        else
                        {
                            allocationJson = JsonSerializer.Serialize(new
                            {
                                RentAllocations = request.RentAllocations,
                                ConsumptionAllocations = request.ConsumptionAllocations,
                                PreviousDebt = request.PreviousDebt
                            });
                        }

                        var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
                        if (setting == null)
                        {
                            _context.SystemSettings.Add(new SystemSetting
                            {
                                Key = key,
                                Value = allocationJson,
                                UpdatedAt = DateTime.UtcNow
                            });
                        }
                        else
                        {
                            setting.Value = allocationJson;
                            setting.UpdatedAt = DateTime.UtcNow;
                            _context.Entry(setting).State = EntityState.Modified;
                        }
                        await _context.SaveChangesAsync();
                    }
                }

                var roundedAmount = Math.Round(request.Amount, 2);
                var result = await _mercadoPagoService.CreateQrOrderAsync(request.TerminalId, roundedAmount, request.Description, request.ReferenceId);
                return Ok(new { Message = "Intent created", Result = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPost("webhook")]
        public async Task<IActionResult> Webhook([FromQuery] string topic, [FromQuery] string id)
        {
            // Mercado Pago sends topic and id in query params
            // Webhook payload can also contain action
            try
            {
                if (topic == "payment" || (Request.Query.ContainsKey("type") && Request.Query["type"] == "payment"))
                {
                    var paymentId = id ?? Request.Query["data.id"].ToString();
                    if (!string.IsNullOrEmpty(paymentId))
                    {
                        object payment = await _mercadoPagoService.GetPaymentAsync(paymentId);
                        if (payment != null)
                        {
                            JsonElement paymentJson = (JsonElement)payment;
                            string status = paymentJson.GetProperty("status").GetString();
                            string externalReference = paymentJson.GetProperty("external_reference").GetString();

                            if (status == "approved" && !string.IsNullOrEmpty(externalReference))
                            {
                                decimal amount = 0;
                                if (paymentJson.TryGetProperty("transaction_amount", out var amountElem))
                                {
                                    if (amountElem.ValueKind == JsonValueKind.Number)
                                    {
                                        amount = amountElem.GetDecimal();
                                    }
                                    else if (amountElem.ValueKind == JsonValueKind.String && decimal.TryParse(amountElem.GetString(), out var parsedAmount))
                                    {
                                        amount = parsedAmount;
                                    }
                                }

                                string actualReference = externalReference;
                                string processedBy = "Sistema";
                                if (externalReference.Contains(";"))
                                {
                                    var parts = externalReference.Split(';');
                                    actualReference = parts[0];
                                    processedBy = parts[1];
                                }

                                if (amount > 0)
                                {
                                    await ProcessApprovedPaymentAsync(actualReference, paymentId, amount, processedBy);
                                }
                                else
                                {
                                    // Fallback just in case
                                    await ProcessApprovedPaymentAsync(actualReference, paymentId, 0, processedBy);
                                }
                            }
                        }
                    }
                }
                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Webhook error: {ex.Message}");
                return Ok(); // Acknowledge the webhook to avoid MP retrying unnecessarily if it's our logic error
            }
        }

        [HttpPost("verify/{bookingId}")]
        public async Task<IActionResult> VerifyBookingPayment(Guid bookingId, [FromQuery] bool isSpace = false)
        {
            try
            {
                var tokenSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_AccessToken");
                var accessToken = tokenSetting?.Value;
                if (string.IsNullOrEmpty(accessToken)) return BadRequest("Mercado Pago Access Token not configured.");

                var url = "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=30";
                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var errContent = await response.Content.ReadAsStringAsync();
                    return BadRequest($"Error searching payments in Mercado Pago: {errContent}");
                }

                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                if (doc.RootElement.TryGetProperty("results", out var resultsProp) && resultsProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var paymentElem in resultsProp.EnumerateArray())
                    {
                        var extRef = paymentElem.TryGetProperty("external_reference", out var extRefProp) ? extRefProp.GetString() : null;
                        var status = paymentElem.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : null;
                        
                        // Extract payment ID safely
                        string paymentId = "";
                        if (paymentElem.TryGetProperty("id", out var idProp))
                        {
                            if (idProp.ValueKind == JsonValueKind.Number)
                            {
                                paymentId = idProp.GetRawText();
                            }
                            else if (idProp.ValueKind == JsonValueKind.String)
                            {
                                paymentId = idProp.GetString() ?? "";
                            }
                        }

                        if (extRef != null && extRef.Contains(bookingId.ToString()) && status == "approved" && !string.IsNullOrEmpty(paymentId))
                        {
                            decimal amount = 0;
                            if (paymentElem.TryGetProperty("transaction_amount", out var amountElem))
                            {
                                if (amountElem.ValueKind == JsonValueKind.Number)
                                {
                                    amount = amountElem.GetDecimal();
                                }
                                else if (amountElem.ValueKind == JsonValueKind.String && decimal.TryParse(amountElem.GetString(), out var parsedAmount))
                                {
                                    amount = parsedAmount;
                                }
                            }

                            string actualReference = extRef;
                            string processedBy = "Sistema";
                            if (extRef.Contains(";"))
                            {
                                var parts = extRef.Split(';');
                                actualReference = parts[0];
                                processedBy = parts[1];
                            }

                            await ProcessApprovedPaymentAsync(actualReference, paymentId, amount, processedBy);
                            return Ok(new { Success = true, Message = "Pago verificado y procesado con éxito.", PaymentId = paymentId });
                        }
                    }
                }

                return Ok(new { Success = false, Message = "No se encontró ningún pago aprobado reciente para esta reserva en Mercado Pago." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        private async Task ProcessApprovedPaymentAsync(string referenceId, string mpPaymentId, decimal amount, string processedBy = "Sistema")
        {
            // Evitar procesamiento duplicado
            if (await _context.Transactions.AnyAsync(t => t.Description != null && t.Description.Contains(mpPaymentId)))
            {
                return;
            }

            // Buscar el usuario por email si processedBy parece un correo electrónico.
            // Si lo encuentra, usamos el UserName del usuario para que coincida con lo esperado por CashClosures (ej. "Admin").
            if (!string.IsNullOrEmpty(processedBy) && processedBy.Contains("@"))
            {
                var userObj = await _context.Users.FirstOrDefaultAsync(u => u.Email == processedBy);
                if (userObj != null)
                {
                    processedBy = userObj.UserName ?? processedBy;
                }
            }

            // Buscar el medio de pago "Pago con QR" o "Mercado Pago" de forma case-insensitive
            var mpMethod = await _context.PaymentMethods.FirstOrDefaultAsync(m => 
                            m.Name.ToLower().Contains("qr") || 
                            m.Name.ToLower().Contains("mercado pago") || 
                            m.Name.ToLower().Contains("mercadopago"))
                           ?? await _context.PaymentMethods.FirstOrDefaultAsync(m => m.IsActive);

            string bookingIdStr = "";
            if (referenceId.StartsWith("B-") || referenceId.StartsWith("S-") || referenceId.StartsWith("D-"))
            {
                bookingIdStr = referenceId.Substring(2);
            }

            var allocKey = $"MP_Alloc_{bookingIdStr}";
            var allocSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == allocKey);
            bool allocationApplied = false;
            var paymentGroupId = Guid.NewGuid();

            if (allocSetting != null)
            {
                try
                {
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    using var doc = JsonDocument.Parse(allocSetting.Value);
                    var root = doc.RootElement;

                    if (referenceId.StartsWith("D-") && (root.TryGetProperty("DirectSalePayload", out var dsProp) || root.TryGetProperty("directSalePayload", out dsProp)))
                    {
                        var directSalePayload = JsonSerializer.Deserialize<BulkDirectSaleRequest>(dsProp.GetRawText(), options);
                        if (directSalePayload != null)
                        {
                            var directSaleId = Guid.TryParse(bookingIdStr, out Guid dsGuid) ? dsGuid : Guid.NewGuid();
                            await ProcessDirectSalePaymentAsync(directSalePayload, mpPaymentId, amount, mpMethod?.Id, processedBy, directSaleId);
                            allocationApplied = true;
                        }
                    }
                    else
                    {
                        // Parsear las asignaciones
                    List<RentAllocation> rentAllocations = new List<RentAllocation>();
                    if (root.TryGetProperty("RentAllocations", out var rentAllocProp) || root.TryGetProperty("rentAllocations", out rentAllocProp))
                    {
                        if (rentAllocProp.ValueKind == JsonValueKind.Array)
                            rentAllocations = JsonSerializer.Deserialize<List<RentAllocation>>(rentAllocProp.GetRawText(), options) ?? new List<RentAllocation>();
                    }

                    List<ConsumptionAllocation> consumptionAllocations = new List<ConsumptionAllocation>();
                    if (root.TryGetProperty("ConsumptionAllocations", out var consAllocProp) || root.TryGetProperty("consumptionAllocations", out consAllocProp))
                    {
                        if (consAllocProp.ValueKind == JsonValueKind.Array)
                            consumptionAllocations = JsonSerializer.Deserialize<List<ConsumptionAllocation>>(consAllocProp.GetRawText(), options) ?? new List<ConsumptionAllocation>();
                    }

                    decimal previousDebt = 0;
                    if (root.TryGetProperty("PreviousDebt", out var prevDebtProp) || root.TryGetProperty("previousDebt", out prevDebtProp))
                    {
                        if (prevDebtProp.ValueKind == JsonValueKind.Number)
                            previousDebt = prevDebtProp.GetDecimal();
                    }

                    // 1. Aplicar pagos a rentas (canchas o espacios)
                    foreach (var rentAlloc in rentAllocations)
                    {
                        if (rentAlloc.Amount <= 0) continue;
                        
                        if (referenceId.StartsWith("B-"))
                        {
                            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == rentAlloc.BookingId);
                            if (booking != null)
                            {
                                booking.DepositPaid += rentAlloc.Amount;
                                if (booking.DepositPaid >= booking.Price)
                                {
                                    booking.Status = BookingStatus.Paid;
                                }

                                var userId = booking.UserId ?? await GetOrCreateParticularUserIdAsync();
                                _context.Transactions.Add(new Transaction
                                {
                                    Amount = rentAlloc.Amount,
                                    Type = TransactionType.Payment,
                                    Date = TimeZoneHelper.GetArgNow(),
                                    Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Renta Cancha Reserva {booking.Id}",
                                    UserId = userId,
                                    PaymentMethodId = mpMethod?.Id,
                                    BookingId = booking.Id,
                                    ProcessedBy = processedBy,
                                    PaymentGroupId = paymentGroupId
                                });
                            }
                        }
                        else if (referenceId.StartsWith("S-"))
                        {
                            var spaceBooking = await _context.SpaceBookings.FirstOrDefaultAsync(sb => sb.Id == rentAlloc.BookingId);
                            if (spaceBooking != null)
                            {
                                spaceBooking.DepositPaid += rentAlloc.Amount;
                                if (spaceBooking.DepositPaid >= spaceBooking.Price)
                                {
                                    spaceBooking.Status = BookingStatus.Paid;
                                }

                                var userId = spaceBooking.UserId ?? await GetOrCreateParticularUserIdAsync();
                                _context.Transactions.Add(new Transaction
                                {
                                    Amount = rentAlloc.Amount,
                                    Type = TransactionType.Payment,
                                    Date = TimeZoneHelper.GetArgNow(),
                                    Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Renta Espacio Reserva {spaceBooking.Id}",
                                    UserId = userId,
                                    PaymentMethodId = mpMethod?.Id,
                                    SpaceBookingId = spaceBooking.Id,
                                    ProcessedBy = processedBy,
                                    PaymentGroupId = paymentGroupId
                                });
                            }
                        }
                    }

                    // 2. Aplicar pagos a consumiciones
                    foreach (var consAlloc in consumptionAllocations)
                    {
                        if (consAlloc.Amount <= 0) continue;

                        var consumption = await _context.BookingConsumptions
                            .Include(c => c.Product)
                            .FirstOrDefaultAsync(c => c.Id == consAlloc.ConsumptionId);
                        
                        if (consumption != null)
                        {
                            consumption.DepositPaid += consAlloc.Amount;
                            if (consumption.DepositPaid >= consumption.TotalPrice)
                            {
                                consumption.IsPaid = true;
                            }

                            var targetBookingId = referenceId.StartsWith("B-") && Guid.TryParse(bookingIdStr, out Guid bId) ? (Guid?)bId : null;
                            var targetSpaceBookingId = referenceId.StartsWith("S-") && Guid.TryParse(bookingIdStr, out Guid sbId) ? (Guid?)sbId : null;
                            var userId = consumption.UserId ?? await GetOrCreateParticularUserIdAsync();

                            _context.Transactions.Add(new Transaction
                            {
                                Amount = consAlloc.Amount,
                                Type = TransactionType.Payment,
                                Date = TimeZoneHelper.GetArgNow(),
                                Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Consumo: {consumption.Product?.Name ?? "Artículo"} (Cant: {consumption.Quantity})",
                                UserId = userId,
                                PaymentMethodId = mpMethod?.Id,
                                BookingId = targetBookingId,
                                SpaceBookingId = targetSpaceBookingId,
                                ProcessedBy = processedBy,
                                PaymentGroupId = paymentGroupId
                            });
                        }
                    }

                    // 3. Aplicar pago a deuda anterior
                    if (previousDebt > 0)
                    {
                        var targetBookingId = referenceId.StartsWith("B-") && Guid.TryParse(bookingIdStr, out Guid bId) ? (Guid?)bId : null;
                        var targetSpaceBookingId = referenceId.StartsWith("S-") && Guid.TryParse(bookingIdStr, out Guid sbId) ? (Guid?)sbId : null;
                        var userId = await GetOrCreateParticularUserIdAsync();

                        _context.Transactions.Add(new Transaction
                        {
                            Amount = previousDebt,
                            Type = TransactionType.Payment,
                            Date = TimeZoneHelper.GetArgNow(),
                            Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Pago Deuda Cta. Cte. Anterior",
                            UserId = userId,
                            PaymentMethodId = mpMethod?.Id,
                            BookingId = targetBookingId,
                            SpaceBookingId = targetSpaceBookingId,
                            ProcessedBy = processedBy,
                            PaymentGroupId = paymentGroupId
                        });
                    }

                    await _context.SaveChangesAsync();
                    }

                    // Limpiar el setting de SystemSettings
                    _context.SystemSettings.Remove(allocSetting);
                    await _context.SaveChangesAsync();
                    
                    allocationApplied = true;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error al aplicar asignación QR, rebotando a fallback: {ex.Message}");
                }
            }

            // Fallback (si no existía asignación o falló el procesamiento específico)
            if (!allocationApplied)
            {
                if (referenceId.StartsWith("B-"))
                {
                    if (Guid.TryParse(referenceId.Substring(2), out Guid bookingId))
                    {
                        var booking = await _context.Bookings
                            .Include(b => b.BookingConsumptions)
                            .FirstOrDefaultAsync(b => b.Id == bookingId);

                        if (booking != null)
                        {
                            var remainingAmount = amount;

                            // 1. Pagar renta de la cancha
                            var rentRemaining = booking.Price - booking.DepositPaid;
                            if (rentRemaining > 0)
                            {
                                var rentPayment = Math.Min(remainingAmount, rentRemaining);
                                booking.DepositPaid += rentPayment;
                                remainingAmount -= rentPayment;
                            }

                            if (booking.DepositPaid >= booking.Price)
                            {
                                booking.Status = BookingStatus.Paid;
                            }

                            // 2. Pagar consumiciones pendientes asociadas
                            if (remainingAmount > 0)
                            {
                                var unpaidConsumptions = booking.BookingConsumptions.Where(c => !c.IsPaid).ToList();
                                foreach (var consumption in unpaidConsumptions)
                                {
                                    if (remainingAmount <= 0) break;
                                    var consumptionRemaining = consumption.TotalPrice - consumption.DepositPaid;
                                    if (consumptionRemaining > 0)
                                    {
                                        var consumptionPayment = Math.Min(remainingAmount, consumptionRemaining);
                                        consumption.DepositPaid += consumptionPayment;
                                        remainingAmount -= consumptionPayment;

                                        if (consumption.DepositPaid >= consumption.TotalPrice)
                                        {
                                            consumption.IsPaid = true;
                                        }
                                    }
                                }
                            }

                            var userId = booking.UserId;
                            if (string.IsNullOrEmpty(userId))
                            {
                                userId = await GetOrCreateParticularUserIdAsync();
                            }

                            // Registrar la transacción de pago total
                            var transaction = new Transaction
                            {
                                Amount = amount,
                                Type = TransactionType.Payment,
                                Date = TimeZoneHelper.GetArgNow(),
                                Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Reserva {bookingId}",
                                UserId = userId,
                                PaymentMethodId = mpMethod?.Id,
                                BookingId = bookingId,
                                ProcessedBy = processedBy,
                                PaymentGroupId = paymentGroupId
                            };
                            _context.Transactions.Add(transaction);
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                else if (referenceId.StartsWith("S-"))
                {
                    if (Guid.TryParse(referenceId.Substring(2), out Guid bookingId))
                    {
                        var spaceBooking = await _context.SpaceBookings
                            .Include(sb => sb.BookingConsumptions)
                            .FirstOrDefaultAsync(sb => sb.Id == bookingId);

                        if (spaceBooking != null)
                        {
                            var remainingAmount = amount;

                            // 1. Pagar renta del espacio
                            var rentRemaining = spaceBooking.Price - spaceBooking.DepositPaid;
                            if (rentRemaining > 0)
                            {
                                var rentPayment = Math.Min(remainingAmount, rentRemaining);
                                spaceBooking.DepositPaid += rentPayment;
                                remainingAmount -= rentPayment;
                            }

                            if (spaceBooking.DepositPaid >= spaceBooking.Price)
                            {
                                spaceBooking.Status = BookingStatus.Paid;
                            }

                            // 2. Pagar consumiciones pendientes asociadas
                            if (remainingAmount > 0)
                            {
                                var unpaidConsumptions = spaceBooking.BookingConsumptions.Where(c => !c.IsPaid).ToList();
                                foreach (var consumption in unpaidConsumptions)
                                {
                                    if (remainingAmount <= 0) break;
                                    var consumptionRemaining = consumption.TotalPrice - consumption.DepositPaid;
                                    if (consumptionRemaining > 0)
                                    {
                                        var consumptionPayment = Math.Min(remainingAmount, consumptionRemaining);
                                        consumption.DepositPaid += consumptionPayment;
                                        remainingAmount -= consumptionPayment;

                                        if (consumption.DepositPaid >= consumption.TotalPrice)
                                        {
                                            consumption.IsPaid = true;
                                        }
                                    }
                                }
                            }

                            var userId = spaceBooking.UserId;
                            if (string.IsNullOrEmpty(userId))
                            {
                                userId = await GetOrCreateParticularUserIdAsync();
                            }

                            // Registrar la transacción de pago total
                            var transaction = new Transaction
                            {
                                Amount = amount,
                                Type = TransactionType.Payment,
                                Date = TimeZoneHelper.GetArgNow(),
                                Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Reserva Espacio {bookingId}",
                                UserId = userId,
                                PaymentMethodId = mpMethod?.Id,
                                SpaceBookingId = bookingId,
                                ProcessedBy = processedBy,
                                PaymentGroupId = paymentGroupId
                            };
                            _context.Transactions.Add(transaction);
                            await _context.SaveChangesAsync();
                        }
                    }
                }
            }
        }

        [HttpGet("oauth-url")]
        public async Task<IActionResult> GetOAuthUrl([FromQuery] string frontendRedirectUri)
        {
            try
            {
                // El callback oficial que registrará el token en el backend
                var scheme = Request.Headers["X-Forwarded-Proto"].ToString();
                if (string.IsNullOrEmpty(scheme)) scheme = Request.Scheme;
                
                // Forzar HTTPS en producción
                if (Request.Host.Host.Contains("blackclubdepadel.com.ar"))
                {
                    scheme = "https";
                }
                var backendCallbackUri = Url.Action("OAuthCallback", "MercadoPago", null, scheme);
                
                // state almacena la URL final de frontend a la que queremos volver
                var url = await _mercadoPagoService.GetOAuthUrlAsync(frontendRedirectUri, backendCallbackUri);
                return Ok(new { Url = url });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpGet("oauth-callback")]
        public async Task<IActionResult> OAuthCallback([FromQuery] string code, [FromQuery] string state)
        {
            try
            {
                var scheme = Request.Headers["X-Forwarded-Proto"].ToString();
                if (string.IsNullOrEmpty(scheme)) scheme = Request.Scheme;

                // Forzar HTTPS en producción
                if (Request.Host.Host.Contains("blackclubdepadel.com.ar"))
                {
                    scheme = "https";
                }
                var backendCallbackUri = Url.Action("OAuthCallback", "MercadoPago", null, scheme);
                await _mercadoPagoService.ExchangeCodeForTokenAsync(code, backendCallbackUri);
                
                // Redirigir de vuelta al frontend con indicador de éxito
                var redirectUrl = state;
                if (redirectUrl.Contains("?"))
                    redirectUrl += "&mp_connect=success";
                else
                    redirectUrl += "?mp_connect=success";
                    
                return Redirect(redirectUrl);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in OAuth Callback: {ex.Message}");
                var redirectUrl = state ?? "/";
                if (redirectUrl.Contains("?"))
                    redirectUrl += $"&mp_connect=error&error={Uri.EscapeDataString(ex.Message)}";
                else
                    redirectUrl += $"?mp_connect=error&error={Uri.EscapeDataString(ex.Message)}";
                    
                return Redirect(redirectUrl);
            }
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var tokenSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_AccessToken");
            var isConnected = tokenSetting != null && !string.IsNullOrEmpty(tokenSetting.Value);
            
            string sellerId = null;
            if (isConnected)
            {
                var parts = tokenSetting.Value.Split('-');
                if (parts.Length >= 4)
                {
                    sellerId = parts[parts.Length - 1];
                }
            }

            return Ok(new { IsConnected = isConnected, SellerId = sellerId });
        }

        [HttpPost("disconnect")]
        public async Task<IActionResult> Disconnect()
        {
            var tokenSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_AccessToken");
            var refreshSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_RefreshToken");
            var expirySetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_TokenExpiry");

            if (tokenSetting != null) _context.SystemSettings.Remove(tokenSetting);
            if (refreshSetting != null) _context.SystemSettings.Remove(refreshSetting);
            if (expirySetting != null) _context.SystemSettings.Remove(expirySetting);

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Mercado Pago desconectado con éxito." });
        }

        [HttpGet("audit-transactions")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAuditTransactions([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var start = startDate ?? TimeZoneHelper.GetArgNow().Date.AddDays(-30);
                var end = endDate ?? TimeZoneHelper.GetArgNow();

                // Buscar medios de pago relacionados a Mercado Pago o QR
                var mpMethodIds = await _context.PaymentMethods
                    .Where(m => m.Name.Contains("Mercado Pago") || m.Name.Contains("QR") || m.Name.Contains("MP"))
                    .Select(m => m.Id)
                    .ToListAsync();

                var query = _context.Transactions
                    .Include(t => t.User)
                    .Include(t => t.PaymentMethod)
                    .Where(t => t.Date >= start && t.Date <= end);

                // Filtrar por ID de medio de pago o descripción
                query = query.Where(t => (t.PaymentMethodId.HasValue && mpMethodIds.Contains(t.PaymentMethodId.Value))
                                         || (t.Description != null && t.Description.Contains("Mercado Pago"))
                                         || (t.Description != null && t.Description.Contains("QR")));

                var list = await query
                    .OrderByDescending(t => t.Date)
                    .Select(t => new {
                        t.Id,
                        t.Amount,
                        t.Date,
                        t.Description,
                        t.ProcessedBy,
                        UserFullName = t.User != null ? t.User.FullName : "Consumidor Final",
                        t.BookingId,
                        t.SpaceBookingId,
                        PaymentMethodName = t.PaymentMethod != null ? t.PaymentMethod.Name : "Mercado Pago"
                    })
                    .ToListAsync();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpGet("payment-details/{paymentId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetPaymentDetails(string paymentId)
        {
            try
            {
                object payment = await _mercadoPagoService.GetPaymentAsync(paymentId);
                if (payment == null) return NotFound("Payment not found in Mercado Pago");
                return Ok(payment);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPost("refund/{paymentId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> RefundPayment(string paymentId)
        {
            try
            {
                var success = await _mercadoPagoService.RefundPaymentAsync(paymentId);
                if (success)
                {
                    return Ok(new { Message = "Pago reembolsado con éxito en Mercado Pago." });
                }
                return BadRequest(new { Message = "No se pudo procesar el reembolso en Mercado Pago." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpGet("diag-payments")]
        public async Task<IActionResult> DiagPayments([FromQuery] string secret)
        {
            if (secret != "padelq2026") return Unauthorized("Invalid secret.");

            var recentTransactions = await _context.Transactions
                .Include(t => t.PaymentMethod)
                .OrderByDescending(t => t.Date)
                .Take(20)
                .Select(t => new {
                    t.Id,
                    t.Amount,
                    t.Date,
                    t.Description,
                    MethodName = t.PaymentMethod != null ? t.PaymentMethod.Name : "null",
                    t.ProcessedBy,
                    t.BookingId,
                    t.SpaceBookingId
                })
                .ToListAsync();

            var openClosures = await _context.CashClosures
                .Where(c => c.IsOpen)
                .Select(c => new {
                    c.Id,
                    c.OpeningDate,
                    c.OpenedBy,
                    c.IsOpen,
                    c.InitialCash
                })
                .ToListAsync();

            var users = await _context.Users
                .Select(u => new {
                    u.Id,
                    u.UserName,
                    u.Email,
                    u.FullName
                })
                .ToListAsync();

            var paymentMethods = await _context.PaymentMethods
                .Select(pm => new {
                    pm.Id,
                    pm.Name,
                    pm.IsActive,
                    pm.HexColor
                })
                .ToListAsync();

            // Simulación de GetCurrentStatus para "Admin"
            var targetUser = "Admin";
            var simActiveClosure = await _context.CashClosures
                .Where(c => c.OpenedBy == targetUser && c.IsOpen)
                .OrderByDescending(c => c.OpeningDate)
                .FirstOrDefaultAsync();

            if (simActiveClosure == null)
            {
                simActiveClosure = await _context.CashClosures
                    .Where(c => c.OpenedBy == targetUser && !c.IsOpen)
                    .OrderByDescending(c => c.OpeningDate)
                    .FirstOrDefaultAsync();
            }

            var startDate = simActiveClosure?.OpeningDate ?? TimeZoneHelper.GetArgNow().Date;
            var endDate = simActiveClosure?.ClosingDate ?? TimeZoneHelper.GetArgNow();

            var simTransactions = await _context.Transactions
                .Include(t => t.PaymentMethod)
                .Include(t => t.User)
                .Where(t => t.Date >= startDate && t.Date <= endDate && t.ProcessedBy == targetUser && (
                    t.Type == TransactionType.Payment || 
                    t.Type == TransactionType.MembershipPayment ||
                    t.Type == TransactionType.CashIn ||
                    t.Type == TransactionType.CashOut
                ))
                .Select(t => new {
                    t.Id,
                    t.Amount,
                    t.Date,
                    t.Description,
                    MethodName = t.PaymentMethod != null ? t.PaymentMethod.Name : "null",
                    t.ProcessedBy
                })
                .ToListAsync();

            return Ok(new {
                RecentTransactions = recentTransactions,
                OpenClosures = openClosures,
                Users = users,
                PaymentMethods = paymentMethods,
                SimulatedClosure = new {
                    ActiveClosureId = simActiveClosure?.Id,
                    StartDate = startDate,
                    EndDate = endDate,
                    TargetUser = targetUser,
                    TransactionCount = simTransactions.Count,
                    Transactions = simTransactions
                }
            });
        }

        private async Task<string> GetOrCreateParticularUserIdAsync()
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == "particular@padelq.com");
            if (user == null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid().ToString(),
                    UserName = "particular@padelq.com",
                    Email = "particular@padelq.com",
                    FullName = "Consumidor Final (Particular)",
                    IsActive = true
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            return user.Id;
        }

        private async Task ProcessDirectSalePaymentAsync(BulkDirectSaleRequest request, string mpPaymentId, decimal amount, int? mpMethodId, string processedBy, Guid paymentGroupId)
        {
            if (request.Items == null || !request.Items.Any()) return;

            var consumptions = new List<BookingConsumption>();
            decimal totalAmount = 0;
            var itemDescriptions = new List<string>();

            // Get employee discount setting if any employee purchase
            decimal discountPct = 0;
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "EmployeeDiscountPercentage");
            if (setting != null)
            {
                decimal.TryParse(setting.Value, out discountPct);
            }

            foreach (var item in request.Items)
            {
                var product = await _context.Products.FindAsync(item.ProductId);
                if (product == null) continue;

                decimal finalPrice = product.FinalPrice;
                var discountAppliedStr = "";

                if (!string.IsNullOrEmpty(request.UserId))
                {
                    var isStaff = await (from ur in _context.UserRoles
                                         join r in _context.Roles on ur.RoleId equals r.Id
                                         where ur.UserId == request.UserId && r.Name == "Staff"
                                         select ur).AnyAsync();
                    if (isStaff && discountPct > 0)
                    {
                        finalPrice = finalPrice * (1.0m - (discountPct / 100.0m));
                        discountAppliedStr = $" (Descuento {discountPct:0.##}%)";
                    }
                }

                var consumption = new BookingConsumption
                {
                    UserId = request.UserId,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    UnitPrice = finalPrice,
                    IsPaid = true,
                    DepositPaid = item.PaidAmount ?? (finalPrice * item.Quantity),
                    Notes = request.Notes ?? "Venta Directa unificada"
                };

                totalAmount += consumption.DepositPaid;
                consumptions.Add(consumption);
                itemDescriptions.Add($"{product.Name} x{item.Quantity}");

                // Stock Control
                string note = $"Venta Directa Bulk (QR): {product.Name} (Pagado){discountAppliedStr}";
                await ApplyStockDeductionAsync(product, item.Quantity, note);
            }

            var itemsSummary = itemDescriptions.Any() ? string.Join(", ", itemDescriptions) : "Bulk";

            var transaction = new Transaction
            {
                UserId = request.UserId,
                Amount = totalAmount,
                Date = TimeZoneHelper.GetArgNow(),
                Type = TransactionType.Payment,
                Description = $"Venta Directa (Pago QR Mercado Pago ID {mpPaymentId}): {itemsSummary}",
                PaymentMethodId = mpMethodId,
                ProcessedBy = processedBy,
                PaymentGroupId = paymentGroupId
            };
            _context.Transactions.Add(transaction);

            _context.BookingConsumptions.AddRange(consumptions);
            await _context.SaveChangesAsync();
        }

        private async Task ApplyStockDeductionAsync(Product product, int quantity, string note)
        {
            if (product.IsRecipe)
            {
                var recipeItems = await _context.ProductRecipeItems.Where(r => r.RecipeProductId == product.Id).ToListAsync();
                foreach (var item in recipeItems)
                {
                    var baseProduct = await _context.Products.FindAsync(item.BaseProductId);
                    if (baseProduct != null)
                    {
                        int deductQuantity = quantity * item.QuantityToDeduct;
                        baseProduct.Stock -= deductQuantity;
                        _context.ProductStockMovements.Add(new ProductStockMovement
                        {
                            ProductId = baseProduct.Id,
                            Type = quantity >= 0 ? MovementType.Sale : MovementType.Adjustment,
                            Quantity = -deductQuantity,
                            Note = $"{note} (Receta: {product.Name})"
                        });
                    }
                }
            }
            else
            {
                product.Stock -= quantity;
                _context.ProductStockMovements.Add(new ProductStockMovement
                {
                    ProductId = product.Id,
                    Type = quantity >= 0 ? MovementType.Sale : MovementType.Adjustment,
                    Quantity = -quantity,
                    Note = note
                });
            }
        }
    }

    public class CreateIntentRequest
    {
        public int TerminalId { get; set; }
        public decimal Amount { get; set; }
        public string Description { get; set; }
        public string ReferenceId { get; set; }
        public List<RentAllocation>? RentAllocations { get; set; }
        public List<ConsumptionAllocation>? ConsumptionAllocations { get; set; }
        public decimal PreviousDebt { get; set; }
        public BulkDirectSaleRequest? DirectSalePayload { get; set; }
    }

    public class RentAllocation
    {
        public Guid BookingId { get; set; }
        public decimal Amount { get; set; }
    }

    public class ConsumptionAllocation
    {
        public Guid ConsumptionId { get; set; }
        public decimal Amount { get; set; }
    }
}
