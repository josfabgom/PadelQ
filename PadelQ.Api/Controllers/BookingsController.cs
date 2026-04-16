using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

using Microsoft.EntityFrameworkCore;
using PadelQ.Infrastructure.Persistence;

namespace PadelQ.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class BookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;
        private readonly ApplicationDbContext _context;

        public BookingsController(IBookingService bookingService, ApplicationDbContext context)
        {
            _bookingService = bookingService;
            _context = context;
        }

        [HttpGet("my-bookings")]
        public async Task<ActionResult<IEnumerable<Booking>>> GetMyBookings()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var bookings = await _bookingService.GetUserBookings(userId);
            return Ok(bookings);
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] CreateBookingRequest request)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var (success, message, bookingId) = await _bookingService.CreateBooking(
                userId, 
                request.CourtId, 
                request.StartTime, 
                request.DurationMinutes
            );

            if (!success) return BadRequest(message);
            
            return Ok(new { BookingId = bookingId, Message = message });
        }

        [HttpGet("by-date")]
        public async Task<ActionResult<IEnumerable<Booking>>> GetByDate([FromQuery] DateTime date)
        {
            var bookings = await _context.Bookings
                .Include(b => b.Court)
                .Include(b => b.User)
                .Where(b => b.StartTime.Date == date.Date && b.Status != BookingStatus.Cancelled)
                .ToListAsync();
            return Ok(bookings);
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("admin-create")]
        public async Task<IActionResult> AdminCreate([FromBody] CreateAdminBookingRequest request)
        {
            var (success, message, bookingId) = await _bookingService.CreateAdminBooking(
                request.UserId,
                request.GuestName,
                request.CourtId,
                request.StartTime,
                request.DurationMinutes
            );

            if (!success) return BadRequest(message);
            
            return Ok(new { BookingId = bookingId, Message = message });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Cancel(Guid id)
        {
            var success = await _bookingService.CancelBooking(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }

    public record CreateBookingRequest(int CourtId, DateTime StartTime, int DurationMinutes);
    public record CreateAdminBookingRequest(string? UserId, string? GuestName, int CourtId, DateTime StartTime, int DurationMinutes);
}
