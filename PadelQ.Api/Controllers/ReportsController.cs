using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using Microsoft.EntityFrameworkCore;
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
        private readonly PadelQ.Infrastructure.Persistence.ApplicationDbContext _context;

        public ReportsController(IBookingService bookingService, ICourtService courtService, PadelQ.Infrastructure.Persistence.ApplicationDbContext context)
        {
            _bookingService = bookingService;
            _courtService = courtService;
            _context = context;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var today = DateTime.Today;
            var startOfMonth = new DateTime(today.Year, today.Month, 1);
            
            var bookings = await _context.Bookings.Where(b => b.Status != BookingStatus.Cancelled).ToListAsync();
            var spaceBookings = await _context.SpaceBookings.Where(b => b.Status != BookingStatus.Cancelled).ToListAsync();

            var todayBookings = bookings.Where(b => b.StartTime.Date == today).Count() + 
                                spaceBookings.Where(b => b.StartTime.Date == today).Count();
            
            var todayRevenue = bookings.Where(b => b.StartTime.Date == today).Sum(b => b.Price) + 
                               spaceBookings.Where(b => b.StartTime.Date == today).Sum(b => b.Price);

            var monthlyRevenue = bookings.Where(b => b.StartTime >= startOfMonth).Sum(b => b.Price) + 
                                 spaceBookings.Where(b => b.StartTime >= startOfMonth).Sum(b => b.Price);

            var monthlyGoalSetting = await _context.SystemSettings.FindAsync("MonthlyGoal");
            decimal monthlyGoal = decimal.TryParse(monthlyGoalSetting?.Value, out var goal) ? goal : 500000;
            
            var progress = monthlyGoal > 0 ? (monthlyRevenue / monthlyGoal) * 100 : 100;

            return Ok(new
            {
                totalRevenue = bookings.Sum(b => b.Price) + spaceBookings.Sum(b => b.Price),
                totalBookings = bookings.Count() + spaceBookings.Count(),
                todayRevenue = todayRevenue,
                todayBookings = todayBookings,
                monthlyRevenue = monthlyRevenue,
                monthlyGoal = monthlyGoal,
                monthlyProgress = Math.Min(100, (int)progress)
            });
        }

        [HttpGet("revenue-stats")]
        public async Task<IActionResult> GetRevenueStats()
        {
            var today = DateTime.Today;
            var last7Days = Enumerable.Range(0, 7)
                .Select(i => today.AddDays(-i))
                .OrderBy(d => d)
                .ToList();

            var bookings = await _context.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= last7Days.First())
                .ToListAsync();

            var spaceBookings = await _context.SpaceBookings
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= last7Days.First())
                .ToListAsync();

            var stats = last7Days.Select(date => new
            {
                date = date.ToString("dd/MM"),
                revenue = bookings.Where(b => b.StartTime.Date == date.Date).Sum(b => b.Price) +
                          spaceBookings.Where(b => b.StartTime.Date == date.Date).Sum(b => b.Price)
            }).ToList();

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
