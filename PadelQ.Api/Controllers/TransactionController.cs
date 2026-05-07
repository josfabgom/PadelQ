using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;



namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/transaction")]
    [Authorize(Roles = "Admin,Staff")]
    public class TransactionController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IBillingService _billingService;

        public TransactionController(ApplicationDbContext context, IBillingService billingService)
        {
            _context = context;
            _billingService = billingService;
        }

        [HttpGet("user/{userId}")]
        public async Task<ActionResult<IEnumerable<Transaction>>> GetUserTransactions(string userId)
        {
            return await _context.Transactions
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.Date)
                .ToListAsync();
        }

        [HttpGet("balance/{userId}")]
        public async Task<ActionResult<decimal>> GetUserBalance(string userId)
        {
            var charges = await _context.Transactions
                .Where(t => t.UserId == userId && t.Type == TransactionType.Charge)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;

            var payments = await _context.Transactions
                .Where(t => t.UserId == userId && t.Type == TransactionType.Payment)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;

            return charges - payments;
        }

        [HttpPost("payment")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<ActionResult<Transaction>> RecordPayment(
            [FromQuery] string? userId, 
            [FromQuery] decimal amount, 
            [FromQuery] string? description, 
            [FromQuery] int? paymentMethodId,
            [FromQuery] Guid? bookingId,
            [FromQuery] Guid? spaceBookingId)
        {
            ApplicationUser? user = null;

            if (!string.IsNullOrEmpty(userId))
            {
                user = await _context.Users.FindAsync(userId);
            }
            
            // Si no hay usuario o no se encontró, usamos o creamos "Consumidor Final"
            if (user == null)
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Email == "particular@padelq.com");
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
                userId = user.Id;
            }

            var transaction = new Transaction
            {
                UserId = userId,
                Amount = amount,
                Date = DateTime.UtcNow,
                Type = TransactionType.Payment,
                Description = description,
                PaymentMethodId = paymentMethodId,
                ProcessedBy = User.Identity?.Name ?? "Sistema",
                BookingId = bookingId,
                SpaceBookingId = spaceBookingId
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        [HttpPost("membership-payment")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<ActionResult<Transaction>> RecordMembershipPayment([FromQuery] string userId, [FromQuery] decimal amount, [FromQuery] string? description, [FromQuery] int? paymentMethodId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found");

            var now = DateTime.UtcNow;

            // VALIDACIÓN ESTRICTA: No permitir pagar si ya está paga y vigente
            var alreadyPaid = await _context.UserMemberships
                .AnyAsync(um => um.UserId == userId && um.IsActive && um.IsPaid && (um.EndDate == null || um.EndDate > now));

            if (alreadyPaid)
            {
                return BadRequest("La membresía de este usuario ya se encuentra paga y vigente. No se puede duplicar el cobro.");
            }

            // Buscar la suscripción activa (o crear una si no existe) para marcarla como paga
            var userMembership = await _context.UserMemberships
                .Where(um => um.UserId == userId && um.IsActive)
                .OrderByDescending(um => um.StartDate)
                .FirstOrDefaultAsync();

            if (userMembership != null)
            {
                userMembership.IsPaid = true;
                userMembership.StartDate = DateTime.UtcNow;
                userMembership.EndDate = DateTime.UtcNow.AddDays(30);
                _context.Entry(userMembership).State = EntityState.Modified;
            }
            else
            {
                // Si no existe el registro técnico, lo creamos ahora para activarlo
                // Buscamos la membresía que el usuario tiene asignada en el perfil (como ayuda)
                // O tomamos la primera disponible que coincida con el monto pagado
                var membership = await _context.Memberships.FirstOrDefaultAsync(m => m.MonthlyPrice <= amount) 
                                 ?? await _context.Memberships.FirstOrDefaultAsync();

                if (membership != null)
                {
                    userMembership = new UserMembership
                    {
                        UserId = userId,
                        MembershipId = membership.Id,
                        StartDate = DateTime.UtcNow,
                        EndDate = DateTime.UtcNow.AddDays(30),
                        IsActive = true,
                        IsPaid = true
                    };
                    _context.UserMemberships.Add(userMembership);
                }
            }

            var transaction = new Transaction
            {
                UserId = userId,
                Amount = amount,
                Date = DateTime.UtcNow,
                Type = TransactionType.MembershipPayment,
                Description = description ?? "Cobro de Cuota Mensual - Membresía Activada",
                PaymentMethodId = paymentMethodId,
                ProcessedBy = User.Identity?.Name ?? "Sistema"
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        [HttpGet("report/payments-by-method")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> GetPaymentsByMethodReport([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var start = startDate ?? DateTime.UtcNow.Date.AddDays(-30);
            var end = endDate ?? DateTime.UtcNow;

            var report = await _context.Transactions
                .Where(t => (t.Type == TransactionType.Payment || t.Type == TransactionType.MembershipPayment) && t.Date >= start && t.Date <= end)
                .GroupBy(t => new { t.PaymentMethodId, MethodName = t.PaymentMethod != null ? t.PaymentMethod.Name : "Sin Especificar", Color = t.PaymentMethod != null ? t.PaymentMethod.HexColor : "#888888" })
                .Select(g => new
                {
                    MethodId = g.Key.PaymentMethodId,
                    MethodName = g.Key.MethodName,
                    Color = g.Key.Color,
                    Total = g.Sum(t => t.Amount),
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Total)
                .ToListAsync();

            return Ok(report);
        }

        [HttpPost("generate-monthly-charges")]

        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GenerateMonthlyCharges()
        {
            var chargesCreated = await _billingService.GenerateMonthlyChargesAsync();
            return Ok(new { message = $"Se generaron {chargesCreated} nuevas cuotas." });
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("reset-account/{userId}")]
        public async Task<IActionResult> WipeUserTransactions(string userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Usuario no encontrado");

            var transactions = await _context.Transactions
                .Where(t => t.UserId == userId)
                .ToListAsync();

            _context.Transactions.RemoveRange(transactions);
            
            // También reseteamos cualquier deuda de membresía para que empiece de cero
            var memberships = await _context.UserMemberships
                .Where(um => um.UserId == userId)
                .ToListAsync();
            
            foreach(var um in memberships) 
            {
               um.IsPaid = false; // Opcional: resetear estado de pago
            }

            await _context.SaveChangesAsync();

            return Ok(new { Message = $"Historial de cuenta corriente para {user.FullName} ha sido reseteado correctamente." });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTransaction(int id)
        {
            var transaction = await _context.Transactions.FindAsync(id);
            if (transaction == null) return NotFound("Transacción no encontrada");

            // SEGURIDAD DE INTEGRIDAD: 
            // Solo permitir borrar si la reserva vinculada NO existe o está en estado Cancelado.
            if (transaction.BookingId.HasValue)
            {
                var booking = await _context.Bookings.FindAsync(transaction.BookingId.Value);
                if (booking != null && booking.Status != BookingStatus.Cancelled)
                {
                    return BadRequest("Seguridad: No se puede borrar este movimiento porque la reserva de cancha vinculada todavía existe y está activa. Debe anular la reserva primero para poder limpiar la caja.");
                }
            }

            if (transaction.SpaceBookingId.HasValue)
            {
                var sbooking = await _context.SpaceBookings.FindAsync(transaction.SpaceBookingId.Value);
                if (sbooking != null && sbooking.Status != BookingStatus.Cancelled)
                {
                    return BadRequest("Seguridad: No se puede borrar este movimiento porque el alquiler de espacio vinculado todavía existe y está activo. Debe anular el alquiler primero.");
                }
            }

            _context.Transactions.Remove(transaction);
            await _context.SaveChangesAsync();

            return NoContent();
        }

    }
}
