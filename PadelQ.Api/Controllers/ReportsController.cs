using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ReportsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("revenue-stats")]
        public async Task<IActionResult> GetRevenueStats()
        {
            var sevenDaysAgo = DateTime.UtcNow.Date.AddDays(-7);
            
            var stats = await _context.Bookings
                .Where(b => b.StartTime >= sevenDaysAgo && b.Status == Domain.Entities.BookingStatus.Confirmed)
                .GroupBy(b => b.StartTime.Date)
                .Select(g => new 
                {
                    Date = g.Key.ToString("yyyy-MM-dd"),
                    Revenue = g.Sum(b => b.Price),
                    Count = g.Count()
                })
                .OrderBy(x => x.Date)
                .ToListAsync();

            return Ok(stats);
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var totalRevenue = await _context.Bookings
                .Where(b => b.Status == Domain.Entities.BookingStatus.Confirmed)
                .SumAsync(b => b.Price);

            var totalBookings = await _context.Bookings.CountAsync();
            var totalCourts = await _context.Courts.CountAsync();

            return Ok(new 
            {
                TotalRevenue = totalRevenue,
                TotalBookings = totalBookings,
                TotalCourts = totalCourts
            });
        }

        [HttpGet("bookings-detailed")]
        public async Task<IActionResult> GetBookingsDetailed()
        {
            var bookings = await _context.Bookings
                .Include(b => b.Court)
                .Include(b => b.User)
                .OrderByDescending(b => b.StartTime)
                .Select(b => new 
                {
                    b.Id,
                    b.StartTime,
                    b.EndTime,
                    CourtName = b.Court != null ? b.Court.Name : "N/A",
                    UserName = b.User != null ? b.User.FullName : "N/A",
                    Status = b.Status.ToString()
                })
                .ToListAsync();

            return Ok(bookings);
        }
    }
}
