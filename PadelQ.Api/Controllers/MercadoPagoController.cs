using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MercadoPagoController : ControllerBase
    {
        private readonly IMercadoPagoService _mercadoPagoService;
        private readonly ApplicationDbContext _context;

        public MercadoPagoController(IMercadoPagoService mercadoPagoService, ApplicationDbContext context)
        {
            _mercadoPagoService = mercadoPagoService;
            _context = context;
        }

        [HttpPost("intent")]
        public async Task<IActionResult> CreateIntent([FromBody] CreateIntentRequest request)
        {
            try
            {
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
                        var payment = await _mercadoPagoService.GetPaymentAsync(paymentId);
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

                                if (amount > 0)
                                {
                                    await ProcessApprovedPaymentAsync(externalReference, paymentId, amount);
                                }
                                else
                                {
                                    // Fallback just in case
                                    await ProcessApprovedPaymentAsync(externalReference, paymentId, 0);
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

        private async Task ProcessApprovedPaymentAsync(string referenceId, string mpPaymentId, decimal amount)
        {
            // Evitar procesamiento duplicado
            if (await _context.Transactions.AnyAsync(t => t.Description != null && t.Description.Contains(mpPaymentId)))
            {
                return;
            }

            // Buscar el medio de pago "Mercado Pago"
            var mpMethod = await _context.PaymentMethods.FirstOrDefaultAsync(m => m.Name.Contains("Mercado Pago"))
                           ?? await _context.PaymentMethods.FirstOrDefaultAsync(m => m.IsActive);

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

                        // Registrar la transacción de pago total
                        var transaction = new Transaction
                        {
                            Amount = amount,
                            Type = TransactionType.Payment,
                            Date = DateTime.UtcNow,
                            Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Reserva {bookingId}",
                            UserId = booking.UserId ?? "System",
                            PaymentMethodId = mpMethod?.Id,
                            BookingId = bookingId
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

                        // Registrar la transacción de pago total
                        var transaction = new Transaction
                        {
                            Amount = amount,
                            Type = TransactionType.Payment,
                            Date = DateTime.UtcNow,
                            Description = $"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Reserva Espacio {bookingId}",
                            UserId = spaceBooking.UserId ?? "System",
                            PaymentMethodId = mpMethod?.Id,
                            SpaceBookingId = bookingId
                        };
                        _context.Transactions.Add(transaction);
                        await _context.SaveChangesAsync();
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
                var backendCallbackUri = Url.Action("OAuthCallback", "MercadoPago", null, Request.Scheme);
                
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
                var backendCallbackUri = Url.Action("OAuthCallback", "MercadoPago", null, Request.Scheme);
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
    }

    public class CreateIntentRequest
    {
        public int TerminalId { get; set; }
        public decimal Amount { get; set; }
        public string Description { get; set; }
        public string ReferenceId { get; set; }
    }
}
