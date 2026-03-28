using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Services
{
    public class BillingService : IBillingService
    {
        private readonly ApplicationDbContext _context;

        public BillingService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<int> GenerateMonthlyChargesAsync()
        {
            var count = 0;
            var today = DateTime.UtcNow;
            
            // Get all active memberships
            var activeMemberships = await _context.UserMemberships
                .Include(um => um.Membership)
                .Where(um => um.IsActive && (um.EndDate == null || um.EndDate > today))
                .ToListAsync();

            foreach (var um in activeMemberships)
            {
                if (um.Membership == null) continue;

                // Check if a charge was already generated for this month
                // This is a simple check: any charge in the current month for this user with "Cuota Mensual"
                var monthStart = new DateTime(today.Year, today.Month, 1);
                var alreadyCharged = await _context.Transactions
                    .AnyAsync(t => t.UserId == um.UserId 
                                && t.Type == TransactionType.Charge 
                                && t.Date >= monthStart 
                                && t.Description.StartsWith("Cuota Mensual"));

                if (!alreadyCharged)
                {
                    var transaction = new Transaction
                    {
                        UserId = um.UserId,
                        Amount = um.Membership.MonthlyPrice,
                        Date = today,
                        Type = TransactionType.Charge,
                        Description = $"Cuota Mensual - {um.Membership.Name} ({today:MMMM yyyy})"
                    };

                    _context.Transactions.Add(transaction);
                    count++;
                }
            }

            if (count > 0)
            {
                await _context.SaveChangesAsync();
            }

            return count;
        }
    }
}
