using PadelQ.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IBookingService
    {
        Task<IEnumerable<Booking>> GetUserBookings(string userId);
        Task<IEnumerable<Booking>> GetCourtBookings(int courtId, DateTime date);
        Task<(bool Success, string Message, Guid BookingId)> CreateBooking(string userId, int courtId, DateTime startTime, int durationMinutes);
        Task<(bool Success, string Message, Guid BookingId)> CreateAdminBooking(string? userId, string? guestName, int courtId, DateTime startTime, int durationMinutes, decimal depositPaid = 0);
        Task<(bool Success, string Message, List<Guid> BookingIds)> CreateRecurringBooking(string? userId, string? guestName, int courtId, DateTime startTime, int durationMinutes, DateTime endDate, decimal depositPaid = 0);
        Task<bool> CancelBooking(Guid bookingId);
        Task<bool> CancelBookingSeries(Guid recurrenceGroupId);
        Task<bool> IsAvailable(int courtId, DateTime start, DateTime end);
        Task<IEnumerable<Booking>> GetAllAsync();
        Task<(bool Success, string Message)> WipeAllBookings();
    }
}
