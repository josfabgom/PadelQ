using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Services
{
    public class BookingService : IBookingService
    {
        private readonly ApplicationDbContext _context;

        public BookingService(ApplicationDbContext context)
        {
            _context = context;
        }

        private async Task<string> GetSetting(string key, string defaultValue)
        {
            var setting = await _context.SystemSettings.FindAsync(key);
            return setting?.Value ?? defaultValue;
        }

        private async Task<int> GetIntSetting(string key, int defaultValue)
        {
            var val = await GetSetting(key, defaultValue.ToString());
            return int.TryParse(val, out var res) ? res : defaultValue;
        }

        private async Task<decimal> GetDecimalSetting(string key, decimal defaultValue)
        {
            var val = await GetSetting(key, defaultValue.ToString());
            return decimal.TryParse(val, out var res) ? res : defaultValue;
        }

        public async Task<IEnumerable<Booking>> GetUserBookings(string userId)
        {
            return await _context.Bookings
                .Include(b => b.Court)
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.StartTime)
                .ToListAsync();
        }

        public async Task<IEnumerable<Booking>> GetCourtBookings(int courtId, DateTime date)
        {
            return await _context.Bookings
                .Where(b => b.CourtId == courtId && b.StartTime.Date == date.Date && b.Status != BookingStatus.Cancelled)
                .ToListAsync();
        }

        public async Task<(bool Success, string Message, Guid BookingId)> CreateBooking(string userId, int courtId, DateTime startTime, int durationMinutes)
        {
            var endTime = startTime.AddMinutes(durationMinutes);
            
            var openHour = await GetIntSetting("OpenHour", 8);
            var closeHour = await GetIntSetting("CloseHour", 23);
            var pricePerHour = await GetDecimalSetting("PricePerHour", 25.0m);

            // Verificación de horario operacional dinámico
            if (startTime.Hour < openHour || endTime.Hour >= closeHour || (endTime.Hour == closeHour && endTime.Minute > 0))
            {
                return (false, $"El club está cerrado. El horario es de {openHour:00}:00 a {closeHour:00}:00 hs.", Guid.Empty);
            }
            // Lógica de Alta Concurrencia mediante Transacciones SQL 'Serializable'
            using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            
            try
            {
                // Verificamos disponibilidad con bloqueo explícito de SQL (UPDLOCK)
                var overlapping = await _context.Bookings
                    .FromSqlRaw(@"SELECT * FROM Bookings WITH (UPDLOCK, HOLDLOCK) 
                                 WHERE CourtId = {0} 
                                 AND Status != {1}
                                 AND ((StartTime < {3} AND EndTime > {2}))", 
                                 courtId, (int)BookingStatus.Cancelled, startTime, endTime)
                    .AnyAsync();

                if (overlapping)
                {
                    return (false, "La cancha ya está reservada para el horario seleccionado.", Guid.Empty);
                }

                var court = await _context.Courts.FindAsync(courtId);
                var effectivePricePerHour = court?.PricePerHour ?? pricePerHour;

                // Aplicar descuento por membresía activa
                var membershipDiscount = await _context.UserMemberships
                    .Include(um => um.Membership)
                    .Where(um => um.UserId == userId && um.IsActive)
                    .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                    .FirstOrDefaultAsync();

                var basePrice = (decimal)(durationMinutes / 60.0) * effectivePricePerHour;
                var finalPrice = basePrice * (1 - (membershipDiscount / 100m));

                var booking = new Booking
                {
                    UserId = userId,
                    CourtId = courtId,
                    StartTime = startTime,
                    EndTime = endTime,
                    Price = finalPrice,
                    Status = BookingStatus.Confirmed
                };

                _context.Bookings.Add(booking);

                // Crear cargo en la cuenta del usuario para la reserva
                var transactionEntry = new Transaction
                {
                    UserId = userId,
                    Amount = finalPrice,
                    Type = TransactionType.Charge,
                    Date = DateTime.UtcNow,
                    Description = $"Reserva de Cancha: {court?.Name ?? "Cancha"}" + (membershipDiscount > 0 ? " (Descuento membresía aplicado)" : "")
                };
                _context.Transactions.Add(transactionEntry);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return (true, "Reserva realizada con éxito.", booking.Id);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return (false, "Ocurrió un error inesperado: " + ex.Message, Guid.Empty);
            }
        }

        public async Task<bool> IsAvailable(int courtId, DateTime start, DateTime end)
        {
             return !await _context.Bookings
                .AnyAsync(b => b.CourtId == courtId 
                    && b.Status != BookingStatus.Cancelled
                    && ( (start < b.EndTime && end > b.StartTime) ));
        }

        public async Task<bool> CancelBooking(Guid bookingId)
        {
            var booking = await _context.Bookings.FindAsync(bookingId);
            if (booking == null) return false;
            
            booking.Status = BookingStatus.Cancelled;
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
