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
                .Where(t => t.Date >= lastClosureDate && (t.Type == TransactionType.Payment || t.Type == TransactionType.MembershipPayment))
                .ToListAsync();

            var summary = transactions
                .GroupBy(t => new { 
                    Name = t.PaymentMethod?.Name ?? "No Especificado", 
                    Color = t.PaymentMethod?.HexColor ?? "#888888" 
                })
                .Select(g => new {
                    Method = g.Key.Name,
                    Color = g.Key.Color,
                    Total = g.Sum(t => t.Amount),
                    Count = g.Count(),
                    Transactions = g.OrderByDescending(t => t.Date).Select(t => new {
                        t.Id,
                        t.Amount,
                        t.Date,
                        t.Description,
                        t.ProcessedBy,
                        UserName = t.User != null ? t.User.FullName : "Particular"
                    }).ToList()
                })
                .ToList();

            return Ok(new {
                activeClosure,
                summary,
                totalAmount = summary.Sum(s => s.Total),
                lastClosureDate
            });
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
                .Where(t => t.Date >= closure.OpeningDate && (t.Type == TransactionType.Payment || t.Type == TransactionType.MembershipPayment))
                .ToListAsync();

            closure.TotalCashSales = transactions.Where(t => t.PaymentMethod?.Name.Contains("Efectivo", StringComparison.OrdinalIgnoreCase) == true).Sum(t => t.Amount);
            closure.TotalTransferSales = transactions.Where(t => t.PaymentMethod?.Name.Contains("Transferencia", StringComparison.OrdinalIgnoreCase) == true).Sum(t => t.Amount);
            closure.TotalCardSales = transactions.Where(t => t.PaymentMethod?.Name.Contains("Tarjeta", StringComparison.OrdinalIgnoreCase) == true).Sum(t => t.Amount);
            closure.TotalOtherSales = transactions.Sum(t => t.Amount) - (closure.TotalCashSales + closure.TotalTransferSales + closure.TotalCardSales);

            closure.ExpectedCash = closure.InitialCash + closure.TotalCashSales; // El esperado físico suele ser lo inicial + ventas en efectivo
            closure.ActualCash = request.ActualCash;
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
                .Where(t => t.Date >= start && t.Date <= end && (t.Type == TransactionType.Payment || t.Type == TransactionType.MembershipPayment))
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

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory()
        {
            var history = await _context.CashClosures
                .OrderByDescending(c => c.OpeningDate)
                .Take(30)
                .ToListAsync();

            return Ok(history);
        }
    }

    public class OpenCashRequest {
        public decimal InitialCash { get; set; }
        public string? Notes { get; set; }
    }

    public class CloseCashRequest {
        public decimal ActualCash { get; set; }
        public string? Notes { get; set; }
    }
}
