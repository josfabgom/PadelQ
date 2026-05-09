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
        public async Task<IActionResult> GetCurrentStatus()
        {
            try 
            {
                var activeClosure = await _context.CashClosures
                    .Where(c => c.IsOpen)
                    .OrderByDescending(c => c.OpeningDate)
                    .FirstOrDefaultAsync();

                var lastClosureDate = activeClosure?.OpeningDate ?? DateTime.UtcNow.Date;
                
                // Si no hay caja abierta, tomamos desde el inicio del día
                if (activeClosure == null) {
                    lastClosureDate = DateTime.UtcNow.Date; 
                }

                var transactions = await _context.Transactions
                    .Include(t => t.PaymentMethod)
                    .Include(t => t.User)
                    .Where(t => t.Date >= lastClosureDate && (
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
                        Total = methodTransactions.Sum(t => t.Amount),
                        Count = methodTransactions.Count(),
                        Transactions = methodTransactions.OrderByDescending(t => t.Date).Select(t => new {
                            t.Id,
                            t.Amount,
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
                        Total = unassignedTrans.Sum(t => t.Amount),
                        Count = unassignedTrans.Count(),
                        Transactions = unassignedTrans.OrderByDescending(t => t.Date).Select(t => new {
                            t.Id,
                            t.Amount,
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
                    totalAmount = transactions.Sum(t => t.Amount),
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
            var openClosure = await _context.CashClosures.AnyAsync(c => c.IsOpen);
            if (openClosure) return BadRequest("Ya existe una caja abierta.");

            var closure = new CashClosure
            {
                OpeningDate = DateTime.UtcNow,
                InitialCash = request.InitialCash,
                OpenedBy = User.Identity?.Name ?? "Admin",
                IsOpen = true,
                Notes = request.Notes
            };

            _context.CashClosures.Add(closure);
            await _context.SaveChangesAsync();

            return Ok(closure);
        }

        [HttpPost("close")]
        public async Task<IActionResult> CloseCash([FromBody] CloseCashRequest request)
        {
            var closure = await _context.CashClosures
                .Where(c => c.IsOpen)
                .OrderByDescending(c => c.OpeningDate)
                .FirstOrDefaultAsync();

            if (closure == null) return NotFound("No hay ninguna caja abierta para cerrar.");

            var transactions = await _context.Transactions
                .Include(t => t.PaymentMethod)
                .Where(t => t.Date >= closure.OpeningDate && (
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
            closure.ClosingDate = DateTime.UtcNow;
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
            var end = closure.ClosingDate ?? DateTime.UtcNow;

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
                    t.Amount,
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
            var activeClosure = await _context.CashClosures.AnyAsync(c => c.IsOpen);
            if (!activeClosure) return BadRequest("No hay una caja abierta para registrar movimientos.");

            var transaction = new Transaction
            {
                UserId = "Particular",
                Amount = request.Amount,
                Date = DateTime.UtcNow,
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
            var history = await _context.CashClosures
                .OrderByDescending(c => c.OpeningDate)
                .Take(30)
                .ToListAsync();

            return Ok(history);
        }

        [HttpPost("force-close-all")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ForceCloseAll()
        {
            var openClosures = await _context.CashClosures.Where(c => c.IsOpen).ToListAsync();
            foreach (var c in openClosures)
            {
                c.IsOpen = false;
                c.ClosingDate = DateTime.UtcNow;
                c.ClosedBy = "Forced by Admin";
            }
            await _context.SaveChangesAsync();
            return Ok("Todas las cajas abiertas han sido cerradas forzosamente.");
        }
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
