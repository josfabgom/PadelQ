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
    [Route("api/[controller]")]
    [Authorize]
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
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Transaction>> RecordPayment([FromQuery] string userId, [FromQuery] decimal amount, [FromQuery] string? description)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found");

            var transaction = new Transaction
            {
                UserId = userId,
                Amount = amount,
                Date = DateTime.UtcNow,
                Type = TransactionType.Payment,
                Description = description
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
                .Where(t => t.Type == TransactionType.Payment && t.Date >= start && t.Date <= end)
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

    }
}
