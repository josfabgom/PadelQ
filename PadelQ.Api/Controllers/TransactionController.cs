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
    [Route("api/[controller]")]
    [Authorize]
    public class TransactionController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TransactionController(ApplicationDbContext context)
        {
            _context = context;
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
                .SumAsync(t => t.Amount);

            var payments = await _context.Transactions
                .Where(t => t.UserId == userId && t.Type == TransactionType.Payment)
                .SumAsync(t => t.Amount);

            return charges - payments;
        }

        [HttpPost("payment")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Transaction>> RecordPayment(string userId, decimal amount, string? description)
        {
            var transaction = new Transaction
            {
                UserId = userId,
                Amount = amount,
                Type = TransactionType.Payment,
                Date = DateTime.UtcNow,
                Description = description ?? "Payment received"
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        [HttpPost("generate-monthly-charges")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GenerateMonthlyCharges()
        {
            var activeUserMemberships = await _context.UserMemberships
                .Include(um => um.Membership)
                .Where(um => um.IsActive)
                .ToListAsync();

            int chargesCreated = 0;
            foreach (var um in activeUserMemberships)
            {
                // Check if already charged this month
                var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
                var alreadyCharged = await _context.Transactions
                    .AnyAsync(t => t.UserId == um.UserId 
                                && t.Type == TransactionType.Charge 
                                && t.Date >= startOfMonth
                                && t.Description != null 
                                && t.Description.Contains("Monthly charge"));

                if (!alreadyCharged && um.Membership != null)
                {
                    var charge = new Transaction
                    {
                        UserId = um.UserId,
                        Amount = um.Membership.MonthlyPrice,
                        Type = TransactionType.Charge,
                        Date = DateTime.UtcNow,
                        Description = $"Monthly charge - {um.Membership.Name} - {DateTime.UtcNow:MMMM yyyy}"
                    };
                    _context.Transactions.Add(charge);
                    chargesCreated++;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Created {chargesCreated} monthly charges." });
        }
    }
}
