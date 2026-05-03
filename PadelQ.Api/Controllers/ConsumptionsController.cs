using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/consumptions")]
    [Authorize(Roles = "Admin,Staff")]
    public class ConsumptionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ConsumptionsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("booking/{bookingId}")]
        public async Task<ActionResult<IEnumerable<BookingConsumption>>> GetByBooking(Guid bookingId)
        {
            return await _context.BookingConsumptions
                .Include(c => c.Product)
                .Where(c => c.BookingId == bookingId || c.SpaceBookingId == bookingId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<BookingConsumption>> AddConsumption([FromBody] AddConsumptionRequest request)
        {
            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null) return NotFound("Producto no encontrado");

            // Detectar si el ID es de una reserva normal o de espacio
            bool isNormalBooking = await _context.Bookings.AnyAsync(b => b.Id == request.BookingId);
            bool isSpaceBooking = !isNormalBooking && await _context.SpaceBookings.AnyAsync(sb => sb.Id == request.BookingId);

            if (!isNormalBooking && !isSpaceBooking)
            {
                return NotFound("Reserva no encontrada");
            }

            var consumption = new BookingConsumption
            {
                BookingId = isNormalBooking ? request.BookingId : null,
                SpaceBookingId = isSpaceBooking ? request.BookingId : null,
                ProductId = request.ProductId,
                Quantity = request.Quantity,
                UnitPrice = product.FinalPrice,
                Notes = request.Notes
            };

            // Stock Control
            product.Stock -= request.Quantity;
            _context.ProductStockMovements.Add(new ProductStockMovement
            {
                ProductId = product.Id,
                Type = MovementType.Sale,
                Quantity = -request.Quantity,
                Note = $"Venta en {(isNormalBooking ? "Reserva" : "Espacio")} {request.BookingId}"
            });

            _context.BookingConsumptions.Add(consumption);

            // Si estaba pagada, volver a estado Confirmado para que aparezca como pendiente
            if (isNormalBooking)
            {
                var b = await _context.Bookings.FindAsync(request.BookingId);
                if (b != null && b.Status == BookingStatus.Paid) b.Status = BookingStatus.Confirmed;
            }
            else if (isSpaceBooking)
            {
                var sb = await _context.SpaceBookings.FindAsync(request.BookingId);
                if (sb != null && sb.Status == BookingStatus.Paid) sb.Status = BookingStatus.Confirmed;
            }

            await _context.SaveChangesAsync();

            return Ok(consumption);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteConsumption(Guid id)
        {
            var consumption = await _context.BookingConsumptions.FindAsync(id);
            if (consumption == null) return NotFound();

            if (consumption.IsPaid)
                return BadRequest("No se puede eliminar un consumo que ya ha sido pagado.");

            // Verificar si el turno ya está cerrado/pagado
            if (consumption.BookingId.HasValue)
            {
                var booking = await _context.Bookings.FindAsync(consumption.BookingId.Value);
                if (booking != null && booking.Status == BookingStatus.Paid)
                    return BadRequest("No se puede eliminar consumos de un turno que ya ha sido pagado completamente.");
            }
            else if (consumption.SpaceBookingId.HasValue)
            {
                var sbooking = await _context.SpaceBookings.FindAsync(consumption.SpaceBookingId.Value);
                if (sbooking != null && sbooking.Status == BookingStatus.Paid)
                    return BadRequest("No se puede eliminar consumos de un alquiler de espacio que ya ha sido pagado completamente.");
            }

            var product = await _context.Products.FindAsync(consumption.ProductId);
            if (product != null)
            {
                product.Stock += consumption.Quantity;
                _context.ProductStockMovements.Add(new ProductStockMovement
                {
                    ProductId = product.Id,
                    Type = MovementType.Adjustment,
                    Quantity = consumption.Quantity,
                    Note = $"Devolución/Borrado en Reserva {consumption.BookingId}"
                });
            }

            _context.BookingConsumptions.Remove(consumption);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("checkout/{bookingId}")]
        public async Task<IActionResult> Checkout(Guid bookingId, [FromQuery] int paymentMethodId)
        {
            var booking = await _context.Bookings.FindAsync(bookingId);
            if (booking == null) return NotFound("Reserva no encontrada");

            var consumptions = await _context.BookingConsumptions
                .Where(c => c.BookingId == bookingId)
                .ToListAsync();

            decimal totalConsumptions = consumptions.Sum(c => c.TotalPrice);
            decimal totalToPay = (booking.Price - booking.DepositPaid) + totalConsumptions;

            if (totalToPay > 0)
            {
                var method = await _context.PaymentMethods.FindAsync(paymentMethodId);
                string description = $"Pago Total (Alquiler + Consumiciones) - {method?.Name ?? "Efectivo"}";

                if (!string.IsNullOrEmpty(booking.UserId))
                {
                    var transaction = new Transaction
                    {
                        UserId = booking.UserId,
                        Amount = totalToPay,
                        Date = DateTime.UtcNow,
                        Type = TransactionType.Payment,
                        Description = description,
                        PaymentMethodId = paymentMethodId
                    };
                    _context.Transactions.Add(transaction);
                }
            }

            // Mark as fully paid
            booking.DepositPaid = booking.Price;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Checkout completado con éxito", TotalPaid = totalToPay });
        }

        [HttpPut("{id}/pay")]
        public async Task<IActionResult> MarkAsPaid(Guid id)
        {
            var consumption = await _context.BookingConsumptions.FindAsync(id);
            if (consumption == null) return NotFound();

            consumption.DepositPaid = consumption.TotalPrice;
            consumption.IsPaid = true;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/partial-pay")]
        public async Task<IActionResult> PartialPay(Guid id, [FromQuery] decimal amount)
        {
            var consumption = await _context.BookingConsumptions.FindAsync(id);
            if (consumption == null) return NotFound();

            consumption.DepositPaid += amount;
            if (consumption.DepositPaid >= consumption.TotalPrice)
            {
                consumption.IsPaid = true;
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Pago parcial de consumo registrado", DepositPaid = consumption.DepositPaid });
        }
    }

    public class AddConsumptionRequest
    {
        public Guid BookingId { get; set; }
        public int ProductId { get; set; }
        public int Quantity { get; set; }
        public string? Notes { get; set; }
    }
}
