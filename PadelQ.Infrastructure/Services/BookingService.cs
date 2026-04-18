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

        public async Task<(bool Success, string Message, Guid BookingId)> CreateAdminBooking(string? userId, string? guestName, int courtId, DateTime startTime, int durationMinutes, decimal depositPaid = 0)
        {
            // Forzar la interpretación de la hora como LOCAL absoluta
            startTime = DateTime.SpecifyKind(startTime, DateTimeKind.Unspecified);
            var endTime = startTime.AddMinutes(durationMinutes);

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
                var pricePerHour = await GetDecimalSetting("PricePerHour", 25.0m);
                var effectivePricePerHour = court?.PricePerHour ?? pricePerHour;

                // Si es un usuario registrado, buscamos su descuento
                decimal membershipDiscount = 0;
                if (!string.IsNullOrEmpty(userId))
                {
                    membershipDiscount = await _context.UserMemberships
                        .Include(um => um.Membership)
                        .Where(um => um.UserId == userId && um.IsActive)
                        .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                        .FirstOrDefaultAsync();
                }

                var basePrice = (decimal)(durationMinutes / 60.0) * effectivePricePerHour;
                var finalPrice = basePrice * (1 - (membershipDiscount / 100m));

                var booking = new Booking
                {
                    UserId = userId,
                    GuestName = guestName,
                    CourtId = courtId,
                    StartTime = startTime,
                    EndTime = endTime,
                    Price = finalPrice,
                    Status = BookingStatus.Confirmed,
                    DepositPaid = depositPaid
                };

                _context.Bookings.Add(booking);

                // Crear cargo en la cuenta si existe el usuario
                if (!string.IsNullOrEmpty(userId))
                {
                    var transactionEntry = new Transaction
                    {
                        UserId = userId,
                        Amount = finalPrice,
                        Type = TransactionType.Charge,
                        Date = DateTime.UtcNow,
                        Description = $"Reserva de Cancha (Admin): {court?.Name ?? "Cancha"}" + (membershipDiscount > 0 ? " (Descuento membresía aplicado)" : "")
                    };
                    _context.Transactions.Add(transactionEntry);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return (true, "Reserva administrativa realizada con éxito.", booking.Id);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return (false, "Error: " + ex.Message, Guid.Empty);
            }
        }

        public async Task<(bool Success, string Message)> WipeAllBookings()
        {
            try
            {
                // Usamos SQL puro para mayor eficiencia al borrar todo
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM Bookings");
                return (true, "Base de datos de reservas limpiada con éxito.");
            }
            catch (Exception ex)
            {
                return (false, "Error al limpiar la base de datos: " + ex.Message);
            }
        }

        public async Task<(bool Success, string Message, List<Guid> BookingIds)> CreateRecurringBooking(string? userId, string? guestName, int courtId, DateTime startTime, int durationMinutes, DateTime endDate, decimal depositPaid = 0)
        {
            var bookingIds = new List<Guid>();
            var recurrenceGroupId = Guid.NewGuid();
            var currentStartTime = startTime;
            
            // Lógica de Alta Concurrencia mediante Transacciones SQL 'Serializable'
            using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            
            try
            {
                var court = await _context.Courts.FindAsync(courtId);
                var pricePerHour = await GetDecimalSetting("PricePerHour", 25.0m);
                var effectivePricePerHour = court?.PricePerHour ?? pricePerHour;

                decimal membershipDiscount = 0;
                if (!string.IsNullOrEmpty(userId))
                {
                    membershipDiscount = await _context.UserMemberships
                        .Include(um => um.Membership)
                        .Where(um => um.UserId == userId && um.IsActive)
                        .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                        .FirstOrDefaultAsync();
                }

                while (currentStartTime <= endDate)
                {
                    var currentEndTime = currentStartTime.AddMinutes(durationMinutes);

                    // Verificar disponibilidad para este intervalo específico
                    var overlapping = await _context.Bookings
                        .FromSqlRaw(@"SELECT * FROM Bookings WITH (UPDLOCK, HOLDLOCK) 
                                     WHERE CourtId = {0} 
                                     AND Status != {1}
                                     AND ((StartTime < {3} AND EndTime > {2}))", 
                                     courtId, (int)BookingStatus.Cancelled, currentStartTime, currentEndTime)
                        .AnyAsync();

                    if (overlapping)
                    {
                        Console.WriteLine($"[CONFLICT] Overlapping booking found on {currentStartTime:dd/MM/yyyy HH:mm} for Court {courtId}");
                        await transaction.RollbackAsync();
                        return (false, $"Conflicto de disponibilidad el día {currentStartTime:dd/MM/yyyy}. Serie cancelada.", new List<Guid>());
                    }

                    var basePrice = (decimal)(durationMinutes / 60.0) * effectivePricePerHour;
                    var finalPrice = basePrice * (1 - (membershipDiscount / 100m));

                    var booking = new Booking
                    {
                        UserId = userId,
                        GuestName = guestName,
                        CourtId = courtId,
                        StartTime = currentStartTime,
                        EndTime = currentEndTime,
                        Price = finalPrice,
                        Status = BookingStatus.Confirmed,
                        RecurrenceGroupId = recurrenceGroupId,
                        DepositPaid = depositPaid
                    };

                    _context.Bookings.Add(booking);

                    if (!string.IsNullOrEmpty(userId))
                    {
                        var transactionEntry = new Transaction
                        {
                            UserId = userId,
                            Amount = finalPrice,
                            Type = TransactionType.Charge,
                            Date = DateTime.UtcNow,
                            Description = $"Reserva Recurrente (Admin): {court?.Name ?? "Cancha"} el {currentStartTime:dd/MM HH:mm}"
                        };
                        _context.Transactions.Add(transactionEntry);
                    }

                    bookingIds.Add(booking.Id);
                    currentStartTime = currentStartTime.AddDays(7); // Semanal
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return (true, $"Se crearon {bookingIds.Count} reservas en la serie.", bookingIds);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return (false, "Error: " + ex.Message, new List<Guid>());
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

        public async Task<bool> CancelBookingSeries(Guid recurrenceGroupId)
        {
            var bookings = await _context.Bookings
                .Where(b => b.RecurrenceGroupId == recurrenceGroupId && b.Status != BookingStatus.Cancelled)
                .ToListAsync();

            if (!bookings.Any()) return false;

            foreach (var b in bookings)
            {
                b.Status = BookingStatus.Cancelled;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<Booking>> GetAllAsync()
        {
            return await _context.Bookings
                .Include(b => b.Court)
                .OrderByDescending(b => b.StartTime)
                .ToListAsync();
        }
    }
}
