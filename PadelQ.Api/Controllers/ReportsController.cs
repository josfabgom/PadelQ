using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ReportsController : ControllerBase
    {
        private readonly IBookingService _bookingService;
        private readonly ICourtService _courtService;

        public ReportsController(IBookingService bookingService, ICourtService courtService)
        {
            _bookingService = bookingService;
            _courtService = courtService;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var bookings = await _bookingService.GetAllAsync();
            var courts = await _courtService.GetAllAsync();

            return Ok(new
            {
                totalRevenue = bookings.Sum(b => b.Price),
                totalBookings = bookings.Count(),
                totalCourts = courts.Count()
            });
        }

        [HttpGet("revenue-stats")]
        public async Task<IActionResult> GetRevenueStats()
        {
            var stats = new List<object>
            {
                new { date = DateTime.UtcNow.AddDays(-6).ToString("dd/MM"), revenue = 150 },
                new { date = DateTime.UtcNow.AddDays(-5).ToString("dd/MM"), revenue = 300 },
                new { date = DateTime.UtcNow.AddDays(-4).ToString("dd/MM"), revenue = 200 },
                new { date = DateTime.UtcNow.AddDays(-3).ToString("dd/MM"), revenue = 450 },
                new { date = DateTime.UtcNow.AddDays(-2).ToString("dd/MM"), revenue = 380 },
                new { date = DateTime.UtcNow.AddDays(-1).ToString("dd/MM"), revenue = 520 },
                new { date = DateTime.UtcNow.ToString("dd/MM"), revenue = 100 }
            };
            return Ok(stats);
        }

        [HttpGet("bookings-detailed")]
        public async Task<IActionResult> GetBookingsDetailed()
        {
            var bookings = await _bookingService.GetAllAsync();
            return Ok(bookings);
        }
    }
}
