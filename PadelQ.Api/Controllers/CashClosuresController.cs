using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    [Route("api/cash-closures")]
    [Authorize(Roles = "Admin,Staff")]
    public class CashClosuresController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CashClosuresController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("current-status")]
        public async Task<IActionResult> GetCurrentStatus([FromQuery] string? userName = null)
        {
            try 
            {
                var isAdmin = User.IsInRole("Admin") || User.IsInRole("Staff");
                var targetUser = User.Identity.Name;

                if (isAdmin && !string.IsNullOrEmpty(userName))
                {
                    targetUser = userName;
                }

                var activeClosure = await _context.CashClosures
                    .Where(c => c.IsOpen && c.OpenedBy == targetUser)
                    .OrderByDescending(c => c.OpeningDate)
                    .FirstOrDefaultAsync();

                var lastClosureDate = activeClosure?.OpeningDate ?? GetArgNow().Date;
                
                // Si no hay caja abierta, tomamos desde el inicio del día
                if (activeClosure == null) {
                    lastClosureDate = GetArgNow().Date; 
                }

                var transactions = await _context.Transactions
                    .Include(t => t.PaymentMethod)
                    .Include(t => t.User)
                    .Where(t => t.Date >= lastClosureDate && t.ProcessedBy == targetUser && (
                        t.Type == TransactionType.Payment || 
                        t.Type == TransactionType.MembershipPayment ||
                        t.Type == TransactionType.CashIn ||
                        t.Type == TransactionType.CashOut
                    ))
                    .ToListAsync();

                var activeMethods = await _context.PaymentMethods.Where(m => m.IsActive).ToListAsync();

                var summary = activeMethods.Select(m => {
                    var methodTransactions = transactions.Where(t => t.PaymentMethodId == m.Id).ToList();
                    return new {
                        Method = m.Name,
                        MethodId = m.Id,
                        Color = m.HexColor ?? "#888888",
                        Total = methodTransactions.Sum(t => t.Type == TransactionType.CashOut ? -t.Amount : t.Amount),
                        Count = methodTransactions.Count(),
                        Transactions = methodTransactions.OrderByDescending(t => t.Date).Select(t => new {
                            t.Id,
                            Amount = t.Type == TransactionType.CashOut ? -t.Amount : t.Amount,
                            t.Date,
                            t.Description,
                            t.ProcessedBy,
                            UserName = t.User != null ? t.User.FullName : "Particular"
                        }).ToList()
                    };
                }).ToList();

                // Agregar "No Especificado" si hay transacciones sin método
                var unassignedTrans = transactions.Where(t => t.PaymentMethodId == null).ToList();
                if (unassignedTrans.Any())
                {
                    summary.Add(new {
                        Method = "No Especificado",
                        MethodId = 0,
                        Color = "#888888",
                        Total = unassignedTrans.Sum(t => t.Type == TransactionType.CashOut ? -t.Amount : t.Amount),
                        Count = unassignedTrans.Count(),
                        Transactions = unassignedTrans.OrderByDescending(t => t.Date).Select(t => new {
                            t.Id,
                            Amount = t.Type == TransactionType.CashOut ? -t.Amount : t.Amount,
                            t.Date,
                            t.Description,
                            t.ProcessedBy,
                            UserName = t.User != null ? t.User.FullName : "Particular"
                        }).ToList()
                    });
                }

                return Ok(new {
                    activeClosure,
                    summary,
                    totalAmount = transactions.Sum(t => t.Type == TransactionType.CashOut ? -t.Amount : t.Amount),
                    lastClosureDate
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error en CurrentStatus: {ex.Message} {ex.InnerException?.Message}");
            }
        }

        [HttpPost("open")]
        public async Task<IActionResult> OpenCash([FromBody] OpenCashRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            try
            {
                var username = User.Identity?.Name ?? "Admin";
                var openClosure = await _context.CashClosures.AnyAsync(c => c.IsOpen && c.OpenedBy == username);
                if (openClosure) 
                {
                    return BadRequest("Ya tienes una caja abierta.");
                }

                var closure = new CashClosure
                {
                    OpeningDate = GetArgNow(),
                    InitialCash = request.InitialCash,
                    OpenedBy = username,
                    IsOpen = true,
                    Notes = request.Notes
                };

                _context.CashClosures.Add(closure);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(closure);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Error al abrir caja: {ex.Message}");
            }
        }

        [HttpPost("close")]
        public async Task<IActionResult> CloseCash([FromBody] CloseCashRequest request)
        {
            var closure = await _context.CashClosures
                .Where(c => c.IsOpen && c.OpenedBy == User.Identity.Name)
                .OrderByDescending(c => c.OpeningDate)
                .FirstOrDefaultAsync();

            if (closure == null) return NotFound("No hay ninguna caja abierta para cerrar.");

            var transactions = await _context.Transactions
                .Include(t => t.PaymentMethod)
                .Where(t => t.Date >= closure.OpeningDate && t.ProcessedBy == User.Identity.Name && (
                    t.Type == TransactionType.Payment || 
                    t.Type == TransactionType.MembershipPayment ||
                    t.Type == TransactionType.CashIn ||
                    t.Type == TransactionType.CashOut
                ))
                .ToListAsync();

            // Calcular totales por tipo de método
            closure.TotalCashSales = transactions
                .Where(t => t.PaymentMethod?.Name.Contains("Efectivo", StringComparison.OrdinalIgnoreCase) == true)
                .Sum(t => t.Amount);

            closure.TotalTransferSales = transactions
                .Where(t => t.PaymentMethod?.Name.Contains("Transferencia", StringComparison.OrdinalIgnoreCase) == true)
                .Sum(t => t.Amount);

            closure.TotalCardSales = transactions
                .Where(t => (t.PaymentMethod?.Name.Contains("Tarjeta", StringComparison.OrdinalIgnoreCase) == true || 
                             t.PaymentMethod?.Name.Contains("Débito", StringComparison.OrdinalIgnoreCase) == true ||
                             t.PaymentMethod?.Name.Contains("Crédito", StringComparison.OrdinalIgnoreCase) == true))
                .Sum(t => t.Amount);

            // Otros: Cualquier cosa que no sea efectivo, transferencia o tarjeta (incluyendo los que no tienen método)
            closure.TotalOtherSales = transactions.Sum(t => t.Amount) 
                - (closure.TotalCashSales ?? 0) 
                - (closure.TotalTransferSales ?? 0) 
                - (closure.TotalCardSales ?? 0);

            closure.TotalCashIn = transactions
                .Where(t => t.Type == TransactionType.CashIn)
                .Sum(t => t.Amount);

            closure.TotalCashOut = transactions
                .Where(t => t.Type == TransactionType.CashOut)
                .Sum(t => t.Amount);

            closure.ExpectedCash = closure.InitialCash + (closure.TotalCashSales ?? 0) + (closure.TotalCashIn ?? 0) - (closure.TotalCashOut ?? 0);
            closure.ActualCash = request.ActualCash;
            closure.ActualTotals = request.ActualTotals; // Se recibe como JSON desde el front
            closure.ClosingDate = GetArgNow();
            closure.ClosedBy = User.Identity?.Name ?? "Admin";
            closure.IsOpen = false;
            closure.Notes = (closure.Notes ?? "") + "\n" + request.Notes;

            await _context.SaveChangesAsync();

            return Ok(closure);
        }

        [HttpGet("{id}/details")]
        public async Task<IActionResult> GetClosureDetails(int id)
        {
            var closure = await _context.CashClosures.FindAsync(id);
            if (closure == null) return NotFound();

            var start = closure.OpeningDate;
            var end = closure.ClosingDate ?? GetArgNow();

            var transactions = await _context.Transactions
                .Include(t => t.PaymentMethod)
                .Include(t => t.User)
                .Where(t => t.Date >= start && t.Date <= end && (
                    t.Type == TransactionType.Payment || 
                    t.Type == TransactionType.MembershipPayment ||
                    t.Type == TransactionType.CashIn ||
                    t.Type == TransactionType.CashOut
                ))
                .OrderBy(t => t.Date)
                .ToListAsync();

            return Ok(new {
                closure,
                transactions = transactions.Select(t => new {
                    t.Id,
                    Amount = t.Type == TransactionType.CashOut ? -t.Amount : t.Amount,
                    t.Date,
                    t.Description,
                    t.ProcessedBy,
                    Method = t.PaymentMethod?.Name ?? "No Especificado",
                    UserName = t.User != null ? t.User.FullName : "Particular"
                })
            });
        }

        [HttpPost("adjustment")]
        public async Task<IActionResult> RegisterAdjustment([FromBody] ManualAdjustmentRequest request)
        {
            var activeClosure = await _context.CashClosures.AnyAsync(c => c.IsOpen && c.OpenedBy == User.Identity.Name);
            if (!activeClosure) return BadRequest("No tienes una caja abierta para registrar movimientos.");

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

            var transaction = new Transaction
            {
                UserId = user.Id,
                Amount = request.Amount,
                Date = GetArgNow(),
                Type = request.IsIncome ? TransactionType.CashIn : TransactionType.CashOut,
                Description = request.Description,
                ProcessedBy = User.Identity?.Name ?? "Admin",
                PaymentMethodId = request.PaymentMethodId
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory()
        {
            var isAdmin = User.IsInRole("Admin") || User.IsInRole("Staff");
            var query = _context.CashClosures.AsQueryable();

            if (!isAdmin)
            {
                query = query.Where(c => c.OpenedBy == User.Identity.Name);
            }

            var history = await query
                .OrderByDescending(c => c.OpeningDate)
                .Take(50)
                .ToListAsync();

            return Ok(history);
        }

        [HttpGet("active-sessions")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> GetActiveSessions()
        {
            var active = await _context.CashClosures
                .Where(c => c.IsOpen)
                .OrderByDescending(c => c.OpeningDate)
                .Select(c => new { 
                    c.OpenedBy, 
                    c.OpeningDate, 
                    c.Id,
                    c.InitialCash
                })
                .ToListAsync();
            return Ok(active);
        }

        [HttpPost("force-close-all")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ForceCloseAll()
        {
            var openClosures = await _context.CashClosures.Where(c => c.IsOpen).ToListAsync();
            foreach (var c in openClosures)
            {
                c.IsOpen = false;
                c.ClosingDate = GetArgNow();
                c.ClosedBy = "Forced by Admin";
            }
            await _context.SaveChangesAsync();
            return Ok("Todas las cajas abiertas han sido cerradas forzosamente.");
        }

        private DateTime GetArgNow() => TimeZoneHelper.GetArgNow();
    }

    public class ManualAdjustmentRequest {
        public decimal Amount { get; set; }
        public string Description { get; set; } = string.Empty;
        public bool IsIncome { get; set; }
        public int? PaymentMethodId { get; set; }
    }

    public class OpenCashRequest {
        public decimal InitialCash { get; set; }
        public string? Notes { get; set; }
    }

    public class CloseCashRequest {
        public decimal ActualCash { get; set; }
        public string? ActualTotals { get; set; } // JSON format
        public string? Notes { get; set; }
    }
}
