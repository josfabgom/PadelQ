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
    [Route("api/spacebookings")]
    [Authorize]
    public class SpaceBookingsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public SpaceBookingsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("by-date")]
        public async Task<ActionResult<IEnumerable<SpaceBooking>>> GetByDate([FromQuery] DateTime date)
        {
            var nextDay = date.Date.AddDays(1);
            var bookings = await _context.SpaceBookings
                .Include(b => b.Space)
                .Include(b => b.BookingConsumptions)
                .Include(b => b.User)
                    .ThenInclude(u => u!.UserMemberships)
                        .ThenInclude(um => um.Membership)
                .Where(b => b.StartTime < nextDay && b.EndTime > date.Date && b.Status != BookingStatus.Cancelled)
                .ToListAsync();
            return Ok(bookings);
        }

        [HttpPost("admin-create")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> AdminCreate([FromBody] SpaceBookingRequest request)
        {
            var userId = request.UserId;

            // Si no hay userId pero hay DNI, intentamos buscar o crear al usuario "Particular"
            if (string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(request.Dni))
            {
                var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Dni == request.Dni);
                if (existingUser != null)
                {
                    userId = existingUser.Id;
                }
                else
                {
                    // Crear nuevo usuario Particular
                    var newUser = new ApplicationUser
                    {
                        Id = Guid.NewGuid().ToString(),
                        UserName = request.Dni, // Usamos DNI como username por defecto
                        Dni = request.Dni,
                        FullName = request.GuestName,
                        PhoneNumber = request.GuestPhone,
                        Email = request.GuestEmail,
                        Address = request.GuestAddress,
                        CreatedAt = DateTime.UtcNow,
                        IsActive = true
                    };
                    _context.Users.Add(newUser);
                    userId = newUser.Id;
                    await _context.SaveChangesAsync();
                }
            }
            // Forzar interpretación LOCAL absoluta compensando cualquier conversión UTC automática del serializador
            var startTime = request.StartTime;
            if (startTime.Kind == DateTimeKind.Utc) {
                startTime = startTime.ToLocalTime();
            }
            startTime = DateTime.SpecifyKind(startTime, DateTimeKind.Unspecified);
            var endTime = startTime.AddMinutes(request.DurationMinutes);

            var space = await _context.Spaces.FindAsync(request.SpaceId);
            if (space == null) return NotFound("Espacio no encontrado");

            // Check overlap
            var overlapping = await _context.SpaceBookings
                .Where(b => b.SpaceId == request.SpaceId && b.Status != BookingStatus.Cancelled)
                .AnyAsync(b => b.StartTime < endTime && b.EndTime > startTime);

            if (overlapping) return BadRequest("El espacio ya está reservado para ese horario.");

            // NUEVO: Check overlap with activities
            var activityOverlapping = await _context.ActivitySchedules
                .AnyAsync(s => s.SpaceId == request.SpaceId 
                            && s.DayOfWeek == startTime.DayOfWeek
                            && ((s.StartTime < endTime.TimeOfDay && s.EndTime > startTime.TimeOfDay)));

            if (activityOverlapping) return BadRequest("El espacio está bloqueado por una actividad programada.");

            // Aplicar descuento por membresía si aplica
            decimal membershipDiscount = 0;
            if (!string.IsNullOrEmpty(userId))
            {
                membershipDiscount = await _context.UserMemberships
                    .Include(um => um.Membership)
                    .Where(um => um.UserId == userId && um.IsActive)
                    .OrderByDescending(um => um.StartDate)
                    .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                    .FirstOrDefaultAsync();
            }

            var basePrice = request.Price ?? space.PricePerSlot;
            var finalPrice = basePrice * (1 - (membershipDiscount / 100m));

            var booking = new SpaceBooking
            {
                SpaceId = request.SpaceId,
                UserId = userId,
                GuestName = request.GuestName,
                GuestAddress = request.GuestAddress,
                GuestPhone = request.GuestPhone,
                GuestEmail = request.GuestEmail,
                StartTime = startTime,
                EndTime = endTime,
                Price = finalPrice,
                DepositPaid = request.DepositPaid,
                Status = BookingStatus.Confirmed,
                CreatedAt = DateTime.UtcNow
            };

            _context.SpaceBookings.Add(booking);

            // Generar cargo en Cta Cte si hay un usuario vinculado
            if (!string.IsNullOrEmpty(userId))
            {
                var transaction = new Transaction
                {
                    UserId = userId,
                    Amount = finalPrice,
                    Type = TransactionType.Charge,
                    Date = DateTime.UtcNow,
                    Description = $"Reserva de Espacio (Admin): {space.Name}" + (membershipDiscount > 0 ? " (Descuento membresía aplicado)" : "")
                };
                _context.Transactions.Add(transaction);
            }

            await _context.SaveChangesAsync();

            return Ok(booking);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Cancel(Guid id)
        {
            var booking = await _context.SpaceBookings
                .Include(b => b.Space)
                .FirstOrDefaultAsync(b => b.Id == id);
            
            if (booking == null) return NotFound();
            
            if (booking.Status == BookingStatus.Paid)
            {
                return BadRequest("No se puede anular un alquiler de espacio que ya ha sido pagado completamente.");
            }

            booking.Status = BookingStatus.Cancelled;

            // Reversar cargo en Cta Cte si hay un usuario vinculado
            if (!string.IsNullOrEmpty(booking.UserId))
            {
                var reversal = new Transaction
                {
                    UserId = booking.UserId,
                    Amount = booking.Price,
                    Type = TransactionType.Payment,
                    Date = DateTime.UtcNow,
                    Description = $"Anulación Reserva Espacio: {booking.Space?.Name ?? "Espacio"} del {booking.StartTime:dd/MM HH:mm}"
                };
                _context.Transactions.Add(reversal);
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/pay")]
        public async Task<IActionResult> MarkAsPaid(Guid id)
        {
            var booking = await _context.SpaceBookings.FindAsync(id);
            if (booking == null) return NotFound();
            
            // Calculamos el total incluyendo consumos
            var consumptionTotal = await _context.BookingConsumptions
                .Where(c => c.SpaceBookingId == id)
                .SumAsync(c => c.UnitPrice * c.Quantity);

            booking.DepositPaid = booking.Price + consumptionTotal;
            booking.Status = BookingStatus.Paid;
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Reserva de espacio marcada como pagada", DepositPaid = booking.DepositPaid });
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/reset-payment")]
        public async Task<IActionResult> ResetPayment(Guid id)
        {
            var booking = await _context.SpaceBookings.FindAsync(id);
            if (booking == null) return NotFound();
            
            booking.DepositPaid = 0;
            booking.Status = BookingStatus.Confirmed;
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Pagos de espacio reseteados con éxito." });
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/partial-pay")]
        public async Task<IActionResult> PartialPay(Guid id, [FromQuery] decimal amount)
        {
            var booking = await _context.SpaceBookings.FindAsync(id);
            if (booking == null) return NotFound();
            
            booking.DepositPaid += amount;
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Pago parcial registrado", DepositPaid = booking.DepositPaid });
        }
    }

    public class SpaceBookingRequest
    {
        public int SpaceId { get; set; }
        public string? UserId { get; set; }
        public string? GuestName { get; set; }
        public string? GuestAddress { get; set; }
        public string? GuestPhone { get; set; }
        public string? GuestEmail { get; set; }
        public string? Dni { get; set; }
        public DateTime StartTime { get; set; }
        public int DurationMinutes { get; set; }
        public decimal? Price { get; set; }
        public decimal DepositPaid { get; set; }
    }
}
