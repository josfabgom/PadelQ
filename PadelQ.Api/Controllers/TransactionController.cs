using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain;
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

        [HttpGet("booking/{bookingId}")]
        public async Task<ActionResult<IEnumerable<Transaction>>> GetBookingTransactions(Guid bookingId)
        {
            return await _context.Transactions
                .Include(t => t.PaymentMethod)
                .Include(t => t.User)
                .Where(t => t.BookingId == bookingId)
                .OrderBy(t => t.Date)
                .ToListAsync();
        }

        [HttpGet("spacebooking/{spaceBookingId}")]
        public async Task<ActionResult<IEnumerable<Transaction>>> GetSpaceBookingTransactions(Guid spaceBookingId)
        {
            return await _context.Transactions
                .Include(t => t.PaymentMethod)
                .Include(t => t.User)
                .Where(t => t.SpaceBookingId == spaceBookingId)
                .OrderBy(t => t.Date)
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

        [HttpGet("previous-debt/{userId}")]
        public async Task<ActionResult<decimal>> GetPreviousDebt(string userId)
        {
            var today = GetArgNow().Date;

            // 1. Saldo de cuenta corriente (Cargos - Pagos) anterior a hoy
            var oldCharges = await _context.Transactions
                .Where(t => t.UserId == userId && t.Type == TransactionType.Charge && t.Date < today)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;

            var oldPayments = await _context.Transactions
                .Where(t => t.UserId == userId && t.Type == TransactionType.Payment && t.Date < today)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;

            var accountDebt = oldCharges - oldPayments;

            // 2. Consumos pendientes de días anteriores (que no están en Transactions todavía)
            var consumptionDebt = await _context.BookingConsumptions
                .Include(c => c.Booking)
                .Where(c => c.UserId == userId && !c.IsPaid && (c.Booking == null || c.Booking.StartTime < today))
                .SumAsync(c => c.UnitPrice * (decimal)c.Quantity - c.DepositPaid);

            return accountDebt + consumptionDebt;
        }

        [HttpPost("payment")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<ActionResult<Transaction>> RecordPayment([FromBody] PaymentRequest request)
        {
            ApplicationUser? user = null;

            if (!string.IsNullOrEmpty(request.UserId))
            {
                user = await _context.Users.FindAsync(request.UserId);
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
                request.UserId = user.Id;
            }

            var transaction = new Transaction
            {
                UserId = request.UserId,
                Amount = request.Amount,
                Date = GetArgNow(),
                Type = TransactionType.Payment,
                Description = request.Description,
                PaymentMethodId = request.PaymentMethodId,
                ProcessedBy = User.Identity?.Name ?? "Sistema",
                BookingId = request.BookingId,
                SpaceBookingId = request.SpaceBookingId,
                ActivityId = request.ActivityId,
                ActivityDate = request.ActivityDate,
                PaymentGroupId = request.PaymentGroupId
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        public class PaymentRequest
        {
            public string? UserId { get; set; }
            public decimal Amount { get; set; }
            public string? Description { get; set; }
            public int? PaymentMethodId { get; set; }
            public Guid? BookingId { get; set; }
            public Guid? SpaceBookingId { get; set; }
            public int? ActivityId { get; set; }
            public DateTime? ActivityDate { get; set; }
            public Guid? PaymentGroupId { get; set; }
        }

        [HttpPost("charge")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<ActionResult<Transaction>> RecordCharge([FromBody] ChargeRequest request)
        {
            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null) return NotFound("Usuario no encontrado");

            var transaction = new Transaction
            {
                UserId = request.UserId,
                Amount = request.Amount,
                Date = GetArgNow(),
                Type = TransactionType.Charge,
                Description = request.Description ?? "Cargo en Cuenta Corriente",
                ProcessedBy = User.Identity?.Name ?? "Sistema",
                BookingId = request.BookingId,
                SpaceBookingId = request.SpaceBookingId,
                ActivityId = request.ActivityId,
                ActivityDate = request.ActivityDate,
                PaymentGroupId = request.PaymentGroupId
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        public class ChargeRequest
        {
            public string UserId { get; set; } = string.Empty;
            public decimal Amount { get; set; }
            public string? Description { get; set; }
            public Guid? BookingId { get; set; }
            public Guid? SpaceBookingId { get; set; }
            public int? ActivityId { get; set; }
            public DateTime? ActivityDate { get; set; }
            public Guid? PaymentGroupId { get; set; }
        }

        [HttpPost("membership-payment")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<ActionResult<Transaction>> RecordMembershipPayment([FromBody] MembershipPaymentRequest request)
        {
            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null) return NotFound("User not found");

            var now = GetArgNow();

            // VALIDACIÓN ESTRICTA: No permitir pagar si ya está paga y vigente
            var alreadyPaid = await _context.UserMemberships
                .AnyAsync(um => um.UserId == request.UserId && um.IsActive && um.IsPaid && (um.EndDate == null || um.EndDate > now));

            if (alreadyPaid)
            {
                return BadRequest("La membresía de este usuario ya se encuentra paga y vigente. No se puede duplicar el cobro.");
            }

            // Buscar la suscripción activa (o crear una si no existe) para marcarla como paga
            var userMembership = await _context.UserMemberships
                .Where(um => um.UserId == request.UserId && um.IsActive)
                .OrderByDescending(um => um.StartDate)
                .FirstOrDefaultAsync();

            if (userMembership != null)
            {
                userMembership.IsPaid = true;
                userMembership.StartDate = GetArgNow();
                userMembership.EndDate = GetArgNow().AddDays(30);
                _context.Entry(userMembership).State = EntityState.Modified;
            }
            else
            {
                var membership = await _context.Memberships.FirstOrDefaultAsync(m => m.MonthlyPrice <= request.Amount) 
                                 ?? await _context.Memberships.FirstOrDefaultAsync();

                if (membership != null)
                {
                    userMembership = new UserMembership
                    {
                        UserId = request.UserId,
                        MembershipId = membership.Id,
                        StartDate = GetArgNow(),
                        EndDate = GetArgNow().AddDays(30),
                        IsActive = true,
                        IsPaid = true
                    };
                    _context.UserMemberships.Add(userMembership);
                }
            }

            var transaction = new Transaction
            {
                UserId = request.UserId,
                Amount = request.Amount,
                Date = GetArgNow(),
                Type = TransactionType.MembershipPayment,
                Description = request.Description ?? "Cobro de Cuota Mensual - Membresía Activada",
                PaymentMethodId = request.PaymentMethodId,
                ProcessedBy = User.Identity?.Name ?? "Sistema"
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        public class MembershipPaymentRequest
        {
            public string UserId { get; set; } = string.Empty;
            public decimal Amount { get; set; }
            public string? Description { get; set; }
            public int? PaymentMethodId { get; set; }
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

        [Authorize(Roles = "Admin,Staff")]
        [HttpPut("{id}/payment-method")]
        public async Task<IActionResult> ChangePaymentMethod(int id, [FromBody] ChangePaymentMethodRequest request)
        {
            var transaction = await _context.Transactions.FindAsync(id);
            if (transaction == null) return NotFound("Transacción no encontrada");

            transaction.PaymentMethodId = request.PaymentMethodId;
            _context.Entry(transaction).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        public class ChangePaymentMethodRequest
        {
            public int? PaymentMethodId { get; set; }
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTransaction(int id)
        {
            var transaction = await _context.Transactions.FindAsync(id);
            if (transaction == null) return NotFound("Transacción no encontrada");

            if (transaction.Type == TransactionType.Payment)
            {
                if (transaction.BookingId.HasValue)
                {
                    var booking = await _context.Bookings.FindAsync(transaction.BookingId.Value);
                    if (booking != null)
                    {
                        bool isRentTransaction = !string.IsNullOrEmpty(transaction.Description) && 
                            (transaction.Description.Contains("Renta Cancha", StringComparison.OrdinalIgnoreCase) || 
                             transaction.Description.Contains("Renta Espacio", StringComparison.OrdinalIgnoreCase));

                        bool isConsumptionTransaction = !string.IsNullOrEmpty(transaction.Description) && 
                            (transaction.Description.IndexOf("x ", StringComparison.OrdinalIgnoreCase) >= 0 ||
                             transaction.Description.Contains("Consumo", StringComparison.OrdinalIgnoreCase));

                        _context.Transactions.Remove(transaction);

                        if (isRentTransaction && !isConsumptionTransaction)
                        {
                            booking.DepositPaid -= transaction.Amount;
                            if (booking.DepositPaid < 0) booking.DepositPaid = 0;
                            
                            if (booking.DepositPaid < booking.Price && booking.Status == BookingStatus.Paid) 
                            {
                                booking.Status = BookingStatus.Confirmed;
                            }
                        }
                        else if (isConsumptionTransaction && !isRentTransaction)
                        {
                            var consumptions = await _context.BookingConsumptions
                                .Where(c => c.BookingId == booking.Id)
                                .OrderByDescending(c => c.CreatedAt)
                                .ToListAsync();
                                
                            decimal toDeduct = transaction.Amount;
                            foreach (var c in consumptions)
                            {
                                if (toDeduct <= 0) break;
                                if (c.DepositPaid > 0)
                                {
                                    decimal deducted = Math.Min(c.DepositPaid, toDeduct);
                                    c.DepositPaid -= deducted;
                                    toDeduct -= deducted;
                                    c.IsPaid = c.DepositPaid >= c.TotalPrice;
                                }
                            }
                        }
                        else
                        {
                            var remainingPayments = await _context.Transactions
                                .Where(t => t.BookingId == booking.Id && t.Id != transaction.Id && t.Type == TransactionType.Payment)
                                .SumAsync(t => t.Amount);

                            booking.DepositPaid = remainingPayments;
                            if (booking.DepositPaid < booking.Price)
                            {
                                if (booking.Status == BookingStatus.Paid) 
                                    booking.Status = BookingStatus.Confirmed;
                            }

                            var consumptions = await _context.BookingConsumptions.Where(c => c.BookingId == booking.Id).ToListAsync();
                            decimal leftOver = remainingPayments - booking.Price;
                            if (leftOver < 0) leftOver = 0;

                            foreach (var c in consumptions)
                            {
                                if (leftOver >= c.TotalPrice)
                                {
                                    c.DepositPaid = c.TotalPrice;
                                    c.IsPaid = true;
                                    leftOver -= c.TotalPrice;
                                }
                                else
                                {
                                    c.DepositPaid = leftOver;
                                    c.IsPaid = false;
                                    leftOver = 0;
                                }
                            }
                        }
                    }
                    else
                    {
                        _context.Transactions.Remove(transaction);
                    }
                }
                else if (transaction.SpaceBookingId.HasValue)
                {
                    var sbooking = await _context.SpaceBookings.FindAsync(transaction.SpaceBookingId.Value);
                    if (sbooking != null)
                    {
                        bool isRentTransaction = !string.IsNullOrEmpty(transaction.Description) && 
                            (transaction.Description.Contains("Renta Cancha", StringComparison.OrdinalIgnoreCase) || 
                             transaction.Description.Contains("Renta Espacio", StringComparison.OrdinalIgnoreCase));

                        bool isConsumptionTransaction = !string.IsNullOrEmpty(transaction.Description) && 
                            (transaction.Description.IndexOf("x ", StringComparison.OrdinalIgnoreCase) >= 0 ||
                             transaction.Description.Contains("Consumo", StringComparison.OrdinalIgnoreCase));

                        _context.Transactions.Remove(transaction);

                        if (isRentTransaction && !isConsumptionTransaction)
                        {
                            sbooking.DepositPaid -= transaction.Amount;
                            if (sbooking.DepositPaid < 0) sbooking.DepositPaid = 0;
                            
                            if (sbooking.DepositPaid < sbooking.Price && sbooking.Status == BookingStatus.Paid) 
                            {
                                sbooking.Status = BookingStatus.Confirmed;
                            }
                        }
                        else if (isConsumptionTransaction && !isRentTransaction)
                        {
                            var consumptions = await _context.BookingConsumptions
                                .Where(c => c.SpaceBookingId == sbooking.Id)
                                .OrderByDescending(c => c.CreatedAt)
                                .ToListAsync();
                                
                            decimal toDeduct = transaction.Amount;
                            foreach (var c in consumptions)
                            {
                                if (toDeduct <= 0) break;
                                if (c.DepositPaid > 0)
                                {
                                    decimal deducted = Math.Min(c.DepositPaid, toDeduct);
                                    c.DepositPaid -= deducted;
                                    toDeduct -= deducted;
                                    c.IsPaid = c.DepositPaid >= c.TotalPrice;
                                }
                            }
                        }
                        else
                        {
                            var remainingPayments = await _context.Transactions
                                .Where(t => t.SpaceBookingId == sbooking.Id && t.Id != transaction.Id && t.Type == TransactionType.Payment)
                                .SumAsync(t => t.Amount);

                            sbooking.DepositPaid = remainingPayments;
                            if (sbooking.DepositPaid < sbooking.Price)
                            {
                                if (sbooking.Status == BookingStatus.Paid) 
                                    sbooking.Status = BookingStatus.Confirmed;
                            }

                            var consumptions = await _context.BookingConsumptions.Where(c => c.SpaceBookingId == sbooking.Id).ToListAsync();
                            decimal leftOver = remainingPayments - sbooking.Price;
                            if (leftOver < 0) leftOver = 0;

                            foreach (var c in consumptions)
                            {
                                if (leftOver >= c.TotalPrice)
                                {
                                    c.DepositPaid = c.TotalPrice;
                                    c.IsPaid = true;
                                    leftOver -= c.TotalPrice;
                                }
                                else
                                {
                                    c.DepositPaid = leftOver;
                                    c.IsPaid = false;
                                    leftOver = 0;
                                }
                            }
                        }
                    }
                    else
                    {
                        _context.Transactions.Remove(transaction);
                    }
                }
                else
                {
                    _context.Transactions.Remove(transaction);
                    
                    if (!string.IsNullOrEmpty(transaction.Description) && transaction.Description.Contains("Venta Directa", StringComparison.OrdinalIgnoreCase))
                    {
                        var timeWindowStart = transaction.Date.AddSeconds(-30);
                        var timeWindowEnd = transaction.Date.AddSeconds(30);
                        
                        var consumptions = await _context.BookingConsumptions
                            .Where(c => c.UserId == transaction.UserId 
                                     && c.BookingId == null 
                                     && c.SpaceBookingId == null 
                                     && c.CreatedAt >= timeWindowStart 
                                     && c.CreatedAt <= timeWindowEnd)
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
                                    Note = $"Devolución por anulación de cobro (Venta Directa anulada)"
                                });
                            }
                            _context.BookingConsumptions.Remove(consumption);
                        }
                    }
                }
            }
            else
            {
                _context.Transactions.Remove(transaction);
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpDelete("group/{groupId}")]
        public async Task<IActionResult> DeleteTransactionGroup(Guid groupId)
        {
            var transactions = await _context.Transactions.Where(t => t.PaymentGroupId == groupId).ToListAsync();
            if (!transactions.Any()) return NotFound("Grupo de transacciones no encontrado");

            // Para evitar problemas de concurrencia o modificaciones en cascada que afecten otros borrados del mismo grupo,
            // podemos reutilizar la logica de DeleteTransaction en un loop (ya que maneja consumos y depósitos).
            // Pero es más seguro hacerlo así:
            foreach (var t in transactions)
            {
                await DeleteTransaction(t.Id);
            }

            return NoContent();
        }

        [HttpGet("activities/by-date")]
        public async Task<ActionResult<IEnumerable<Transaction>>> GetActivityTransactionsByDate([FromQuery] DateTime date)
        {
            var start = date.Date;
            var end = start.AddDays(1);

            return await _context.Transactions
                .Where(t => t.ActivityId.HasValue && t.ActivityDate >= start && t.ActivityDate < end)
                .ToListAsync();
        }

        private DateTime GetArgNow() => TimeZoneHelper.GetArgNow();

    }
}
