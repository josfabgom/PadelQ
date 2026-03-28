using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Services
{
    public class CourtService : ICourtService
    {
        private readonly ApplicationDbContext _context;

        public CourtService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Court>> GetAllAsync()
        {
            return await _context.Courts.Where(c => c.IsActive).ToListAsync();
        }

        public async Task<Court?> GetByIdAsync(int id)
        {
            return await _context.Courts.FindAsync(id);
        }

        public async Task<int> CreateAsync(Court court)
        {
            _context.Courts.Add(court);
            await _context.SaveChangesAsync();
            return court.Id;
        }

        public async Task UpdateAsync(Court court)
        {
            var dbCourt = await _context.Courts.FindAsync(court.Id);
            if (dbCourt != null)
            {
                dbCourt.Name = court.Name;
                dbCourt.IsIndoor = court.IsIndoor;
                dbCourt.SurfaceType = court.SurfaceType;
                dbCourt.PricePerHour = court.PricePerHour;
                dbCourt.IsActive = court.IsActive;
                await _context.SaveChangesAsync();
            }
        }

        public async Task DeleteAsync(int id)
        {
            var court = await _context.Courts.FindAsync(id);
            if (court != null)
            {
                court.IsActive = false; // Soft delete
                await _context.SaveChangesAsync();
            }
        }
    }
}
