
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

        [AllowAnonymous]
        [HttpGet("ping-version")]
        public IActionResult Ping() => Ok(new { Version = "1.0.5-wipe-fixed", Status = "Alive" });

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
            var nextDay = date.Date.AddDays(1);
            var bookings = await _context.Bookings
                .Include(b => b.Court)
                .Include(b => b.User)
                    .ThenInclude(u => u!.UserMemberships)
                        .ThenInclude(um => um.Membership)
                .Where(b => b.StartTime < nextDay && b.EndTime > date.Date && b.Status != BookingStatus.Cancelled)
                .ToListAsync();
            return Ok(bookings);
        }

        [HttpGet("by-range")]
        public async Task<ActionResult<IEnumerable<Booking>>> GetByRange([FromQuery] DateTime start, [FromQuery] DateTime end)
        {
            var bookings = await _context.Bookings
                .Include(b => b.Court)
                .Include(b => b.User)
                    .ThenInclude(u => u!.UserMemberships)
                        .ThenInclude(um => um.Membership)
                .Where(b => b.StartTime >= start && b.StartTime <= end && b.Status != BookingStatus.Cancelled)
                .ToListAsync();
            return Ok(bookings);
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("admin-create")]
        public async Task<IActionResult> AdminCreate([FromBody] CreateAdminBookingRequest request)
        {
            if (request.IsRecurring && request.EndDate.HasValue)
            {
                var (success, message, bookingIds) = await _bookingService.CreateRecurringBooking(
                    request.UserId,
                    request.GuestName,
                    request.GuestPhone,
                    request.GuestEmail,
                    request.Dni,
                    request.CourtId,
                    request.StartTime,
                    request.DurationMinutes,
                    request.EndDate.Value,
                    request.DepositPaid
                );

                if (!success) return BadRequest(message);
                return Ok(new { BookingIds = bookingIds, Message = message });
            }
            else
            {
                var (success, message, bookingId) = await _bookingService.CreateAdminBooking(
                    request.UserId,
                    request.GuestName,
                    request.GuestPhone,
                    request.GuestEmail,
                    request.Dni,
                    request.CourtId,
                    request.StartTime,
                    request.DurationMinutes,
                    request.DepositPaid
                );

                if (!success) return BadRequest(message);
                return Ok(new { BookingId = bookingId, Message = message });
            }
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpDelete("series/{recurrenceGroupId}")]
        public async Task<IActionResult> CancelSeries(Guid recurrenceGroupId)
        {
            var success = await _bookingService.CancelBookingSeries(recurrenceGroupId);
            if (!success) 
            {
                return NotFound("No se encontraron reservas futuras en esta serie.");
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Cancel(Guid id)
        {
            var success = await _bookingService.CancelBooking(id);
            if (!success) return NotFound();
            return NoContent();
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("wipe-all")]
        public async Task<IActionResult> WipeAllData()
        {
            var (success, message) = await _bookingService.WipeAllBookings();
            if (!success) return BadRequest(message);
            return Ok(new { Message = message });
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/pay")]
        public async Task<IActionResult> MarkAsPaid(Guid id)
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null) return NotFound();
            
            booking.DepositPaid = booking.Price;
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Reserva marcada como pagada", DepositPaid = booking.DepositPaid });
        }
    }

    public class CreateBookingRequest
    {
        public int CourtId { get; set; }
        public DateTime StartTime { get; set; }
        public int DurationMinutes { get; set; }
    }

    public class CreateAdminBookingRequest
    {
        public string? UserId { get; set; }
        public string? GuestName { get; set; }
        public string? GuestPhone { get; set; }
        public string? GuestEmail { get; set; }
        public string? Dni { get; set; }
        public int CourtId { get; set; }
        public DateTime StartTime { get; set; }
        public int DurationMinutes { get; set; }
        public bool IsRecurring { get; set; } = false;
        public DateTime? EndDate { get; set; }
        public decimal DepositPaid { get; set; } = 0;
    }
}
