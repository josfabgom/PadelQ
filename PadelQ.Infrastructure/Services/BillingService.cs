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
            // Automated membership charges are disabled per v2.8 internal requirements. 
            // Memberships are now tracked via descriptive MembershipPayment logs.
            return 0;
        }
    }
}

