using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
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
                    .ThenInclude(c => c.Product)
                .Include(b => b.User)
                    .ThenInclude(u => u!.UserMemberships)
                        .ThenInclude(um => um.Membership)
                .Where(b => b.StartTime < nextDay && b.EndTime > date.Date && b.Status != BookingStatus.Cancelled)
                .ToListAsync();
            return Ok(bookings);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var booking = await _context.SpaceBookings
                .Include(b => b.Space)
                .Include(b => b.BookingConsumptions)
                    .ThenInclude(c => c.Product)
                .Include(b => b.User)
                    .ThenInclude(u => u!.UserMemberships)
                        .ThenInclude(um => um.Membership)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound();
            return Ok(booking);
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
                        UserName = !string.IsNullOrEmpty(request.GuestEmail) ? request.GuestEmail : request.Dni,
                        Dni = request.Dni,
                        FullName = request.GuestName ?? $"Particular {request.Dni}",
                        PhoneNumber = request.GuestPhone,
                        Email = !string.IsNullOrEmpty(request.GuestEmail) ? request.GuestEmail : $"{request.Dni}@padelq.com",
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
                    Date = TimeZoneHelper.GetArgNow(),
                    Description = $"Reserva de Espacio (Admin): {space.Name}" + (membershipDiscount > 0 ? " (Descuento membresía aplicado)" : ""),
                    SpaceBookingId = booking.Id
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
            
            // Si estaba PAGA, generamos un contra-asiento en la caja (Payment negativo)
            if (booking.Status == BookingStatus.Paid)
            {
                var lastPayment = await _context.Transactions
                    .Where(t => t.SpaceBookingId == id && t.Type == TransactionType.Payment)
                    .OrderByDescending(t => t.Date)
                    .FirstOrDefaultAsync();

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

                var reversalPayment = new Transaction
                {
                    UserId = booking.UserId ?? user.Id,
                    Amount = -booking.DepositPaid,
                    Type = TransactionType.Payment,
                    Date = TimeZoneHelper.GetArgNow(),
                    Description = $"Devolución por Anulación Reserva Espacio PAGA: {booking.Space?.Name ?? "Espacio"} del {booking.StartTime:dd/MM HH:mm}",
                    SpaceBookingId = booking.Id,
                    PaymentMethodId = lastPayment?.PaymentMethodId,
                    ProcessedBy = "Sistema (Anulación)"
                };
                _context.Transactions.Add(reversalPayment);
            }

            booking.Status = BookingStatus.Cancelled;
            
            // Devolver stock de consumiciones vinculadas
            var consumptions = await _context.BookingConsumptions
                .Where(c => c.SpaceBookingId == id)
                .ToListAsync();

            foreach (var consumption in consumptions)
            {
                var product = await _context.Products.FindAsync(consumption.ProductId);
                if (product != null)
                {
                    product.Stock += consumption.Quantity;
                    _context.ProductStockMovements.Add(new ProductStockMovement
                    {
                        ProductId = product.Id,
                        Type = MovementType.Adjustment,
                        Quantity = consumption.Quantity,
                        Note = $"Devolución por anulación de reserva espacio: {booking.Id}",
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            // Eliminar consumiciones para que no aparezcan en ventas
            _context.BookingConsumptions.RemoveRange(consumptions);

            // Reversar cargo en Cta Cte si hay un usuario vinculado
            if (!string.IsNullOrEmpty(booking.UserId))
            {
                var reversalCharge = new Transaction
                {
                    UserId = booking.UserId,
                    Amount = -booking.Price, // Cargo negativo
                    Type = TransactionType.Charge,
                    Date = TimeZoneHelper.GetArgNow(),
                    Description = $"Anulación Reserva Espacio: {booking.Space?.Name ?? "Espacio"} del {booking.StartTime:dd/MM HH:mm}",
                    SpaceBookingId = booking.Id
                };
                _context.Transactions.Add(reversalCharge);
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

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/extend")]
        public async Task<IActionResult> Extend(Guid id, [FromQuery] int minutes)
        {
            var booking = await _context.SpaceBookings.Include(b => b.Space).FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return NotFound("Reserva no encontrada.");

            var newEndTime = booking.EndTime.AddMinutes(minutes);

            // Check overlap
            var overlapping = await _context.SpaceBookings
                .Where(b => b.Id != id && b.SpaceId == booking.SpaceId && b.Status != BookingStatus.Cancelled)
                .AnyAsync(b => b.StartTime < newEndTime && b.EndTime > booking.StartTime);

            if (overlapping) return BadRequest("No se puede extender el tiempo: el espacio ya está reservado para el horario siguiente.");

            // Recalcular precio (asumimos precio proporcional basado en el precio por slot si el precio original era el base)
            // Para espacios, a veces es más complejo, pero usaremos el precio por slot del espacio dividido 60m como base
            var space = booking.Space;
            var pricePerSlot = space?.PricePerSlot ?? 0;
            
            // Calculamos el extra proporcional (asumiendo que el slot base es el que se usa habitualmente)
            // Si no, simplemente usamos una lógica de precio por hora si existe.
            // En este sistema parece que Space tiene PricePerSlot.
            decimal extraPrice = (decimal)(minutes / 60.0) * (pricePerSlot / 1.0m); // Ajustar si el slot no es de 60m

            // Descuento membresía
            decimal membershipDiscount = 0;
            if (!string.IsNullOrEmpty(booking.UserId))
            {
                membershipDiscount = await _context.UserMemberships
                    .Include(um => um.Membership)
                    .Where(um => um.UserId == booking.UserId && um.IsActive)
                    .OrderByDescending(um => um.StartDate)
                    .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                    .FirstOrDefaultAsync();
            }

            var finalExtraPrice = extraPrice * (1 - (membershipDiscount / 100m));

            booking.EndTime = newEndTime;
            booking.Price += finalExtraPrice;

            // Registro en Cta Cte
            if (!string.IsNullOrEmpty(booking.UserId))
            {
                var transaction = new Transaction
                {
                    UserId = booking.UserId,
                    Amount = finalExtraPrice,
                    Type = TransactionType.Charge,
                    Date = TimeZoneHelper.GetArgNow(),
                    Description = $"Extensión de Tiempo (+{minutes} min): {space?.Name ?? "Espacio"}",
                    SpaceBookingId = booking.Id
                };
                _context.Transactions.Add(transaction);
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Tiempo extendido con éxito" });
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/undo-extension")]
        public async Task<IActionResult> UndoExtension(Guid id)
        {
            var booking = await _context.SpaceBookings.Include(b => b.Space).FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return NotFound("Reserva no encontrada.");

            // Buscar la última transacción de extensión
            var lastExtension = await _context.Transactions
                .Where(t => t.SpaceBookingId == id && t.Type == TransactionType.Charge && t.Description.Contains("Extensión de Tiempo"))
                .OrderByDescending(t => t.Date)
                .FirstOrDefaultAsync();

            if (lastExtension == null) return BadRequest("No se encontraron extensiones para deshacer.");

            // Intentar extraer los minutos de la descripción
            int minutesToRemove = 0;
            var match = Regex.Match(lastExtension.Description ?? "", @"\+(\d+)\s*(?:min|m)?", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                minutesToRemove = int.Parse(match.Groups[1].Value);
            }
            else
            {
                return BadRequest($"No se pudo determinar la duración en la descripción: '{lastExtension.Description}'");
            }

            // Revertir cambios
            booking.EndTime = booking.EndTime.AddMinutes(-minutesToRemove);
            booking.Price -= lastExtension.Amount;

            // Eliminar la transacción de la extensión
            _context.Transactions.Remove(lastExtension);

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Última extensión deshecha con éxito" });
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
