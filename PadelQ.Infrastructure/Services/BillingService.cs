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
            var today = DateTime.UtcNow.Date;
            
            // Get tolerance setting (default to 5 days)
            var toleranceSetting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "BillingToleranceDays");
            
            int toleranceDays = 5;
            if (toleranceSetting != null && int.TryParse(toleranceSetting.Value, out int parsedValue))
            {
                toleranceDays = parsedValue;
            }

            // Get all active memberships that have an expiration date
            var membershipsToCharge = await _context.UserMemberships
                .Include(um => um.Membership)
                .Where(um => um.IsActive && um.EndDate != null)
                .ToListAsync();

            foreach (var um in membershipsToCharge)
            {
                if (um.Membership == null) continue;

                var expirationDate = um.EndDate.Value.Date;
                var generationThreshold = expirationDate.AddDays(-toleranceDays);

                // If today is within the tolerance window of the expiration date
                if (today >= generationThreshold)
                {
                    // Calculate the period we are charging for
                    // Usually it's the next month after the current expiration
                    var nextExpiration = expirationDate.AddMonths(1);
                    
                    // Simple check to avoid duplicates: 
                    // Any charge with "Cuota Mensual" for this user containing the NEW expiration date in description
                    var searchPattern = $"(Venc: {nextExpiration:dd/MM/yyyy})";
                    var alreadyCharged = await _context.Transactions
                        .AnyAsync(t => t.UserId == um.UserId 
                                    && t.Type == TransactionType.Charge 
                                    && t.Description != null 
                                    && t.Description.Contains(searchPattern));

                    if (!alreadyCharged)
                    {
                        var transaction = new Transaction
                        {
                            UserId = um.UserId,
                            Amount = um.Membership.MonthlyPrice,
                            Date = DateTime.UtcNow,
                            Type = TransactionType.Charge,
                            Description = $"Cuota Mensual - {um.Membership.Name} ({expirationDate:dd/MM} - {nextExpiration:dd/MM}) {searchPattern}"
                        };

                        _context.Transactions.Add(transaction);
                        count++;
                    }
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

