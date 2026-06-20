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
                if (request.RentAllocations != null || request.ConsumptionAllocations != null || request.PreviousDebt > 0)
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
                        var allocationJson = JsonSerializer.Serialize(new
                        {
                            RentAllocations = request.RentAllocations,
                            ConsumptionAllocations = request.ConsumptionAllocations,
                            PreviousDebt = request.PreviousDebt
                        });

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

                var result = await _mercadoPagoService.CreateQrOrderAsync(request.TerminalId, request.Amount, request.Description, request.ReferenceId);
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

            // Buscar el medio de pago "Pago con QR" o "Mercado Pago"
            var mpMethod = await _context.PaymentMethods.FirstOrDefaultAsync(m => m.Name.Contains("QR") || m.Name.Contains("Mercado Pago"))
                           ?? await _context.PaymentMethods.FirstOrDefaultAsync(m => m.IsActive);

            string bookingIdStr = "";
            if (referenceId.StartsWith("B-") || referenceId.StartsWith("S-"))
            {
                bookingIdStr = referenceId.Substring(2);
            }

            var allocKey = $"MP_Alloc_{bookingIdStr}";
            var allocSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == allocKey);
            bool allocationApplied = false;

            if (allocSetting != null)
            {
                try
                {
                    var allocation = JsonSerializer.Deserialize<JsonElement>(allocSetting.Value);
                    
                    // Parsear las asignaciones
                    List<RentAllocation> rentAllocations = new List<RentAllocation>();
                    if (allocation.TryGetProperty("RentAllocations", out var rentAllocProp) && rentAllocProp.ValueKind == JsonValueKind.Array)
                    {
                        rentAllocations = JsonSerializer.Deserialize<List<RentAllocation>>(rentAllocProp.GetRawText()) ?? new List<RentAllocation>();
                    }

                    List<ConsumptionAllocation> consumptionAllocations = new List<ConsumptionAllocation>();
                    if (allocation.TryGetProperty("ConsumptionAllocations", out var consAllocProp) && consAllocProp.ValueKind == JsonValueKind.Array)
                    {
                        consumptionAllocations = JsonSerializer.Deserialize<List<ConsumptionAllocation>>(consAllocProp.GetRawText()) ?? new List<ConsumptionAllocation>();
                    }

                    decimal previousDebt = 0;
                    if (allocation.TryGetProperty("PreviousDebt", out var prevDebtProp) && prevDebtProp.ValueKind == JsonValueKind.Number)
                    {
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
                                    ProcessedBy = processedBy
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
                                    ProcessedBy = processedBy
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
                                ProcessedBy = processedBy
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
                            ProcessedBy = processedBy
                        });
                    }

                    await _context.SaveChangesAsync();

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
                                ProcessedBy = processedBy
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
                                ProcessedBy = processedBy
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
