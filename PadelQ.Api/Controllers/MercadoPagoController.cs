using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Linq;
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
                            string status = payment.GetProperty("status").GetString();
                            string externalReference = payment.GetProperty("external_reference").GetString();

                            if (status == "approved" && !string.IsNullOrEmpty(externalReference))
                            {
                                // We can process the payment status based on externalReference (e.g., BookingId or ConsumptionId)
                                // This requires updating Booking/Consumption as Paid.
                                await ProcessApprovedPaymentAsync(externalReference, paymentId);
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

        private async Task ProcessApprovedPaymentAsync(string referenceId, string mpPaymentId)
        {
            // referenceId could be formatted like "B-1234" for Bookings or "C-5678" for Consumptions
            if (referenceId.StartsWith("B-"))
            {
                if (Guid.TryParse(referenceId.Substring(2), out Guid bookingId))
                {
                    var booking = await _context.Bookings.FindAsync(bookingId);
                    if (booking != null && booking.Status != BookingStatus.Paid)
                    {
                        booking.Status = BookingStatus.Paid;
                        // Determine MP payment method if possible
                        var mpMethod = _context.PaymentMethods.FirstOrDefault(m => m.Name.Contains("Mercado Pago"));
                        
                        var transaction = new Transaction
                        {
                            Amount = booking.Price - booking.DepositPaid,
                            Type = TransactionType.Payment,
                            Date = DateTime.UtcNow,
                            Description = $"Pago por QR MP Point - Reserva {bookingId}",
                            UserId = booking.UserId,
                            PaymentMethodId = mpMethod?.Id
                        };
                        _context.Transactions.Add(transaction);
                        await _context.SaveChangesAsync();
                    }
                }
            }
            // Add similar logic for Consumptions if "C-" prefix
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
