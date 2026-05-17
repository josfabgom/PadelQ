using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.RegularExpressions;
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

        private async Task<string> GetOrCreateParticularUserIdAsync()
        {
            var particularUser = await _context.Users.FirstOrDefaultAsync(u => u.UserName == "particular@padelq.com" || u.Email == "particular@padelq.com");
            if (particularUser != null) return particularUser.Id;

            var newUser = new ApplicationUser
            {
                Id = Guid.NewGuid().ToString(),
                UserName = "particular@padelq.com",
                Email = "particular@padelq.com",
                FullName = "Consumidor Final",
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();
            return newUser.Id;
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

            // Verificación de horario operacional para usuarios de la APP (opcionalmente más estricta si se requiere)
            // Permitimos que termine a medianoche (Hour 0, Minute 0)
            bool isBeforeOpen = startTime.Hour < openHour;
            bool isAfterClose = endTime.Date == startTime.Date && endTime.Hour > closeHour;

            if (isBeforeOpen || isAfterClose)
            {
                return (false, $"El club está cerrado en ese horario. Abre a las {openHour:00}:00 hs.", Guid.Empty);
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
                    .OrderByDescending(um => um.StartDate)
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
                    Description = $"Reserva de Cancha: {court?.Name ?? "Cancha"}" + (membershipDiscount > 0 ? " (Descuento membresía aplicado)" : ""),
                    BookingId = booking.Id
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

        public async Task<(bool Success, string Message, Guid BookingId)> CreateAdminBooking(string? userId, string? guestName, string? guestPhone, string? guestEmail, string? dni, int courtId, DateTime startTime, int durationMinutes, decimal depositPaid = 0)
        {
            // Forzar la interpretación de la hora como LOCAL absoluta compensando conversiones UTC
            if (startTime.Kind == DateTimeKind.Utc)
            {
                startTime = startTime.ToLocalTime();
            }
            startTime = DateTime.SpecifyKind(startTime, DateTimeKind.Unspecified);
            var endTime = startTime.AddMinutes(durationMinutes);

            // Nota: Para reservas administrativas omitimos el check de horario operacional 
            // para permitir flexibilidad al administrador (eventos, cierres tarde, etc.)

            // Si no hay userId pero hay DNI, intentamos buscar o crear al usuario ""Particular""
            if (string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(dni))
            {
                var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Dni == dni);
                if (existingUser != null)
                {
                    userId = existingUser.Id;
                }
                else
                {
                    var newUser = new ApplicationUser
                    {
                        Id = Guid.NewGuid().ToString(),
                        UserName = !string.IsNullOrEmpty(guestEmail) ? guestEmail : dni,
                        Dni = dni,
                        FullName = guestName ?? $"Particular {dni}",
                        PhoneNumber = guestPhone,
                        Email = !string.IsNullOrEmpty(guestEmail) ? guestEmail : $"{dni}@padelq.com",
                        CreatedAt = DateTime.UtcNow,
                        IsActive = true
                    };
                    _context.Users.Add(newUser);
                    userId = newUser.Id;
                    await _context.SaveChangesAsync();
                }
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
                var pricePerHour = await GetDecimalSetting("PricePerHour", 25.0m);
                var effectivePricePerHour = court?.PricePerHour ?? pricePerHour;

                // Si es un usuario registrado, buscamos su descuento
                decimal membershipDiscount = 0;
                if (!string.IsNullOrEmpty(userId))
                {
                    var now = DateTime.UtcNow;
                    membershipDiscount = await _context.UserMemberships
                        .Include(um => um.Membership)
                        .Where(um => um.UserId == userId && um.IsActive)
                        .OrderByDescending(um => um.StartDate)
                        .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                        .FirstOrDefaultAsync();
                }

                var basePrice = (decimal)(durationMinutes / 60.0) * effectivePricePerHour;
                var finalPrice = basePrice * (1 - (membershipDiscount / 100m));

                var booking = new Booking
                {
                    UserId = userId,
                    GuestName = guestName,
                    GuestPhone = guestPhone,
                    GuestEmail = guestEmail,
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
                        Description = $"Reserva de Cancha (Admin): {court?.Name ?? "Cancha"}" + (membershipDiscount > 0 ? " (Descuento membresía aplicado)" : ""),
                        BookingId = booking.Id
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
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Restituir stock sumando las cantidades de las consumiciones
                await _context.Database.ExecuteSqlRawAsync(@"
                    UPDATE Products
                    SET Stock = Stock + ISNULL((
                        SELECT SUM(Quantity)
                        FROM BookingConsumptions
                        WHERE BookingConsumptions.ProductId = Products.Id
                    ), 0)
                    WHERE EXISTS (
                        SELECT 1 FROM BookingConsumptions WHERE BookingConsumptions.ProductId = Products.Id
                    )
                ");

                // Borrar datos en orden para no romper Foreign Keys
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM BookingConsumptions");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM Bookings");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SpaceBookings");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM Transactions");

                await transaction.CommitAsync();
                return (true, "Base de datos de reservas y cuentas corrientes limpiada con éxito. Stock restituido correctamente.");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return (false, "Error al limpiar la base de datos: " + ex.Message);
            }
        }

        public async Task<(bool Success, string Message, List<Guid> BookingIds)> CreateRecurringBooking(string? userId, string? guestName, string? guestPhone, string? guestEmail, string? dni, int courtId, DateTime startTime, int durationMinutes, DateTime endDate, decimal depositPaid = 0)
        {
            var bookingIds = new List<Guid>();
            var recurrenceGroupId = Guid.NewGuid();

            // Si no hay userId pero hay DNI, intentamos buscar o crear al usuario ""Particular""
            if (string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(dni))
            {
                var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Dni == dni);
                if (existingUser != null)
                {
                    userId = existingUser.Id;
                }
                else
                {
                    var newUser = new ApplicationUser
                    {
                        Id = Guid.NewGuid().ToString(),
                        UserName = !string.IsNullOrEmpty(guestEmail) ? guestEmail : dni,
                        Dni = dni,
                        FullName = guestName ?? $"Particular {dni}",
                        PhoneNumber = guestPhone,
                        Email = !string.IsNullOrEmpty(guestEmail) ? guestEmail : $"{dni}@padelq.com",
                        CreatedAt = DateTime.UtcNow,
                        IsActive = true
                    };
                    _context.Users.Add(newUser);
                    userId = newUser.Id;
                    await _context.SaveChangesAsync();
                }
            }
            // Forzar interpretación LOCAL absoluta compensando conversiones UTC
            if (startTime.Kind == DateTimeKind.Utc)
            {
                startTime = startTime.ToLocalTime();
            }
            startTime = DateTime.SpecifyKind(startTime, DateTimeKind.Unspecified);

            var currentStartTime = startTime;
            // Aseguramos que el endDate incluya todo el día final (hasta 23:59:59)
            var finalEndDate = endDate.Date.AddDays(1).AddSeconds(-1);

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
                        .OrderByDescending(um => um.StartDate)
                        .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                        .FirstOrDefaultAsync();
                }

                while (currentStartTime <= finalEndDate)
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

                    // NUEVO: Verificar si hay actividades (clases) bloqueando la cancha
                    var activityOverlapping = await _context.ActivitySchedules
                        .AnyAsync(s => s.CourtId == courtId
                                    && s.DayOfWeek == currentStartTime.DayOfWeek
                                    && ((s.StartTime < currentEndTime.TimeOfDay && s.EndTime > currentStartTime.TimeOfDay)));

                    if (activityOverlapping)
                    {
                        await transaction.RollbackAsync();
                        return (false, $"La cancha está bloqueada por una actividad programada el día {currentStartTime:dd/MM/yyyy}. Serie cancelada.", new List<Guid>());
                    }

                    var basePrice = (decimal)(durationMinutes / 60.0) * effectivePricePerHour;
                    var finalPrice = basePrice * (1 - (membershipDiscount / 100m));

                    var booking = new Booking
                    {
                        UserId = userId,
                        GuestName = guestName,
                        GuestPhone = guestPhone,
                        GuestEmail = guestEmail,
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
                            Description = $"Reserva Recurrente (Admin): {court?.Name ?? "Cancha"} el {currentStartTime:dd/MM HH:mm}",
                            BookingId = booking.Id
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
            var bookingOverlap = await _context.Bookings
               .AnyAsync(b => b.CourtId == courtId
                   && b.Status != BookingStatus.Cancelled
                   && ((start < b.EndTime && end > b.StartTime)));

            var activityOverlap = await _context.ActivitySchedules
               .AnyAsync(s => s.CourtId == courtId
                           && s.DayOfWeek == start.DayOfWeek
                           && ((s.StartTime < end.TimeOfDay && s.EndTime > start.TimeOfDay)));

            return !bookingOverlap && !activityOverlap;
        }

        public async Task<bool> CancelBooking(Guid bookingId)
        {
            var booking = await _context.Bookings
                .Include(b => b.Court)
                .FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return false;

            // Si la reserva estaba PAGA, debemos reversar el PAGO en la caja (Libro Diario)
            if (booking.Status == BookingStatus.Paid)
            {
                // Buscamos el último pago de esta reserva para copiar el medio de pago si es posible
                var lastPayment = await _context.Transactions
                    .Where(t => t.BookingId == bookingId && t.Type == TransactionType.Payment)
                    .OrderByDescending(t => t.Date)
                    .FirstOrDefaultAsync();

                var effectiveUserId = booking.UserId;
                if (string.IsNullOrEmpty(effectiveUserId))
                {
                    effectiveUserId = await GetOrCreateParticularUserIdAsync();
                }

                var reversalPayment = new Transaction
                {
                    UserId = effectiveUserId,
                    Amount = -booking.DepositPaid, // Restamos lo que se pagó
                    Type = TransactionType.Payment, // Tipo Payment para que reste de la caja
                    Date = DateTime.UtcNow,
                    Description = $"Devolución por Anulación Reserva PAGA: {booking.Court?.Name ?? "Cancha"} del {booking.StartTime:dd/MM HH:mm}",
                    BookingId = booking.Id,
                    PaymentMethodId = lastPayment?.PaymentMethodId,
                    ProcessedBy = "Sistema (Anulación)"
                };
                _context.Transactions.Add(reversalPayment);
            }

            booking.Status = BookingStatus.Cancelled;

            // Devolver stock de consumiciones vinculadas
            var consumptions = await _context.BookingConsumptions
                .Where(c => c.BookingId == bookingId)
                .ToListAsync();

            foreach (var consumption in consumptions)
            {
                var product = await _context.Products.FindAsync(consumption.ProductId);
                if (product != null)
                {
                    product.Stock += consumption.Quantity;
                    _context.ProductStockMovements.Add(new ProductStockMovement
                    {
                        ProductId = product.Id,
                        Type = MovementType.Adjustment,
                        Quantity = consumption.Quantity,
                        Note = $"Devolución por anulación de reserva: {booking.Id}",
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            // Eliminar consumiciones vinculadas para que no aparezcan en reportes de ventas
            _context.BookingConsumptions.RemoveRange(consumptions);

            // Si tenía usuario (y no estaba paga, o para compensar el cargo original), compensamos la deuda en su Cta Cte
            // Nota: Si estaba paga, el cargo original (+Price) y el pago original (-Price) ya se compensaban.
            // Al anular, agregamos el reversal del pago (vuelve a tener deuda) y el reversal del cargo (vuelve a cero).
            if (!string.IsNullOrEmpty(booking.UserId))
            {
                var reversalCharge = new Transaction
                {
                    UserId = booking.UserId,
                    Amount = -booking.Price, // Cargo negativo para restar de la deuda sin entrar a caja
                    Type = TransactionType.Charge,
                    Date = DateTime.UtcNow,
                    Description = $"Anulación Reserva: {booking.Court?.Name ?? "Cancha"} del {booking.StartTime:dd/MM HH:mm}",
                    BookingId = booking.Id
                };
                _context.Transactions.Add(reversalCharge);
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> CancelBookingSeries(Guid recurrenceGroupId)
        {
            var bookings = await _context.Bookings
                .Include(b => b.Court)
                .Where(b => b.RecurrenceGroupId == recurrenceGroupId && b.Status != BookingStatus.Cancelled)
                .ToListAsync();

            if (!bookings.Any()) return false;

            foreach (var b in bookings)
            {
                b.Status = BookingStatus.Cancelled;

                // Devolver stock de consumiciones
                var consumptions = await _context.BookingConsumptions
                    .Where(c => c.BookingId == b.Id)
                    .ToListAsync();

                foreach (var consumption in consumptions)
                {
                    var product = await _context.Products.FindAsync(consumption.ProductId);
                    if (product != null)
                    {
                        product.Stock += consumption.Quantity;
                        _context.ProductStockMovements.Add(new ProductStockMovement
                        {
                            ProductId = product.Id,
                            Type = MovementType.Adjustment,
                            Quantity = consumption.Quantity,
                            Note = $"Devolución por anulación de serie: {recurrenceGroupId}",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                // Eliminar consumiciones de la serie
                _context.BookingConsumptions.RemoveRange(consumptions);

                // Si cada turno tenía un cargo en Cta Cte, lo compensamos uno a uno
                if (!string.IsNullOrEmpty(b.UserId))
                {
                    var reversal = new Transaction
                    {
                        UserId = b.UserId,
                        Amount = -b.Price, // Cargo negativo
                        Type = TransactionType.Charge,
                        Date = DateTime.UtcNow,
                        Description = $"Anulación Serie Recurrente: {b.Court?.Name ?? "Cancha"} del {b.StartTime:dd/MM HH:mm}",
                        BookingId = b.Id
                    };
                    _context.Transactions.Add(reversal);
                }
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

        public async Task<(bool Success, string Message)> ExtendBooking(Guid bookingId, int extraMinutes)
        {
            var booking = await _context.Bookings.Include(b => b.Court).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return (false, "Reserva no encontrada.");

            var newEndTime = booking.EndTime.AddMinutes(extraMinutes);

            // Verificar solapamiento (excluyendo la propia reserva)
            var overlapping = await _context.Bookings
                .AnyAsync(b => b.Id != bookingId && b.CourtId == booking.CourtId && b.Status != BookingStatus.Cancelled
                          && b.StartTime < newEndTime && b.EndTime > booking.StartTime);

            if (overlapping) return (false, "No se puede extender el tiempo: hay otro turno reservado inmediatamente después.");

            // Recalcular precio del tiempo extra
            var pricePerHour = await GetDecimalSetting("PricePerHour", 25.0m);
            var effectivePricePerHour = booking.Court?.PricePerHour ?? pricePerHour;

            decimal membershipDiscount = 0;
            if (!string.IsNullOrEmpty(booking.UserId))
            {
                membershipDiscount = await _context.UserMemberships
                    .Include(um => um.Membership)
                    .Where(um => um.UserId == booking.UserId && um.IsActive)
                    .OrderByDescending(um => um.StartDate)
                    .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                    .FirstOrDefaultAsync();
            }

            var extraPrice = (decimal)(extraMinutes / 60.0) * effectivePricePerHour;
            var finalExtraPrice = extraPrice * (1 - (membershipDiscount / 100m));

            booking.EndTime = newEndTime;
            booking.Price += finalExtraPrice;

            // Crear cargo extra en Cta Cte siempre, para poder rastrearlo en 'Deshacer'
            var effectiveUserIdForExtension = booking.UserId;
            if (string.IsNullOrEmpty(effectiveUserIdForExtension))
            {
                effectiveUserIdForExtension = await GetOrCreateParticularUserIdAsync();
            }

            var transactionEntry = new Transaction
            {
                UserId = effectiveUserIdForExtension,
                Amount = finalExtraPrice,
                Type = TransactionType.Charge,
                Date = DateTime.UtcNow,
                Description = $"Extensión de Tiempo (+{extraMinutes} min): {booking.Court?.Name ?? "Cancha"}",
                BookingId = booking.Id
            };
            _context.Transactions.Add(transactionEntry);

            await _context.SaveChangesAsync();
            return (true, "Tiempo extendido con éxito.");
        }

        public async Task<(bool Success, string Message)> UndoBookingExtension(Guid bookingId)
        {
            var booking = await _context.Bookings.Include(b => b.Court).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return (false, "Reserva no encontrada.");

            // Buscar la última transacción de extensión
            var lastExtension = await _context.Transactions
                .Where(t => t.BookingId == bookingId && t.Type == TransactionType.Charge && t.Description.Contains("Extensión de Tiempo"))
                .OrderByDescending(t => t.Date)
                .FirstOrDefaultAsync();

            if (lastExtension == null) return (false, "No se encontraron extensiones para deshacer.");

            // Intentar extraer los minutos de la descripción: "Extensión de Tiempo (+30 min): ..."
            int minutesToRemove = 0;
            // Regex más flexible: busca el número después del '+' y antes de 'min' o 'm' o solo el número
            var match = Regex.Match(lastExtension.Description ?? "", @"\+(\d+)\s*(?:min|m)?", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                minutesToRemove = int.Parse(match.Groups[1].Value);
            }
            else
            {
                // Fallback: Si no hay descripción clara, pero sabemos que es una extensión, 
                // podríamos intentar adivinar por el precio, pero es arriesgado.
                // Mejor informamos el error exacto.
                return (false, $"No se pudo determinar la duración en la descripción: '{lastExtension.Description}'");
            }

            // Revertir cambios
            booking.EndTime = booking.EndTime.AddMinutes(-minutesToRemove);
            booking.Price -= lastExtension.Amount;

            // Eliminar la transacción de la extensión
            _context.Transactions.Remove(lastExtension);

            await _context.SaveChangesAsync();
            return (true, "Última extensión deshecha con éxito.");
        }
    }
}
