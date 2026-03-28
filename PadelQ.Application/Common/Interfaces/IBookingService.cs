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
        Task<bool> CancelBooking(Guid bookingId);
        Task<bool> IsAvailable(int courtId, DateTime start, DateTime end);
    }
}
