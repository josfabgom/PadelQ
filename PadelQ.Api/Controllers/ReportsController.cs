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

        [Authorize(Roles = "Admin")]
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            // Ajuste para horario local (UTC-3)
            var todayUtc = DateTime.UtcNow;
            var fallbackToday = todayUtc.AddHours(-3).Date; 
            
            // Buscar la ÃšLTIMA caja (abierta o cerrada)
            var latestClosure = await _context.CashClosures
                .OrderByDescending(c => c.OpeningDate)
                .FirstOrDefaultAsync();

            var activeClosure = await _context.CashClosures
                .Where(c => c.IsOpen)
                .OrderByDescending(c => c.OpeningDate)
                .FirstOrDefaultAsync();

            DateTime today = fallbackToday;
            DateTime tomorrow = fallbackToday.AddDays(1).AddHours(6);

            // Para la caja (dinero cobrado) usamos el horario de la Ãºltima caja
            if (latestClosure != null)
            {
                today = latestClosure.OpeningDate;
                tomorrow = latestClosure.ClosingDate ?? DateTime.UtcNow.AddHours(24);
            }

            // Para la proyecciÃ³n (Reservas del DÃ­a) usamos el dÃ­a calendario (desde 00:00)
            DateTime calendarToday = fallbackToday;
            DateTime calendarTomorrow = fallbackToday.AddDays(1).AddHours(6);

            var startOfMonth = new DateTime(todayUtc.Year, todayUtc.Month, 1);
            
            // 1. Reservas de Hoy (Filtramos usando el calendario del dÃ­a)
            var todayBookingsList = await _context.Bookings
                .Include(b => b.Court)
                .Include(b => b.User)
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= calendarToday && b.StartTime < calendarTomorrow)
                .ToListAsync();

            var todaySpaceBookingsList = await _context.SpaceBookings
                .Include(b => b.Space)
                .Include(b => b.User)
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= calendarToday && b.StartTime < calendarTomorrow)
                .ToListAsync();

            var todayBookingsCount = todayBookingsList.Count + todaySpaceBookingsList.Count;
            
            // 2. Ingreso del dÃ­a (Lo alquilado teÃ³ricamente, todas las reservas)
            var todayBookingsRevenue = todayBookingsList.Sum(b => b.Price) + todaySpaceBookingsList.Sum(b => b.Price);

            // 3. Consumiciones del dÃ­a (Solo lo COBRADO, segÃºn lo solicitado)
            var transactions = await _context.Transactions
                .Where(t => t.Date >= today && t.Date < tomorrow && (t.Type == TransactionType.Payment || t.Type == TransactionType.MembershipPayment || t.Type == TransactionType.CashIn || t.Type == TransactionType.CashOut))
                .ToListAsync();

            var incomeTransactions = transactions.Where(t => t.Type == TransactionType.Payment || t.Type == TransactionType.MembershipPayment || t.Type == TransactionType.CashIn).ToList();
            decimal todayConsumptionsRevenue = 0;
            decimal todayRentalsRevenue = 0;

            foreach (var t in incomeTransactions)
            {
                var desc = t.Description ?? "";
                if (desc.Contains("Alquiler + Consumiciones", StringComparison.OrdinalIgnoreCase))
                {
                    if (t.BookingId.HasValue)
                    {
                        var bookingCons = await _context.BookingConsumptions
                            .Where(c => c.BookingId == t.BookingId.Value)
                            .SumAsync(c => c.UnitPrice * c.Quantity);
                        var consAmount = Math.Min(t.Amount, bookingCons);
                        todayConsumptionsRevenue += consAmount;
                        todayRentalsRevenue += (t.Amount - consAmount);
                    }
                    else
                    {
                        todayRentalsRevenue += t.Amount;
                    }
                }
                else if (desc.Contains("Consumo", StringComparison.OrdinalIgnoreCase) || 
                         desc.Contains("Consumicion", StringComparison.OrdinalIgnoreCase) || 
                         desc.Contains("Venta Directa", StringComparison.OrdinalIgnoreCase) || 
                         desc.Contains("Cantina", StringComparison.OrdinalIgnoreCase))
                {
                    todayConsumptionsRevenue += t.Amount;
                }
                else if (t.Type == TransactionType.Payment)
                {
                    // Si es un Payment normal y no dice consumo, entonces es alquiler de cancha
                    todayRentalsRevenue += t.Amount;
                }
            }

            var todayActualPayments = todayRentalsRevenue + todayConsumptionsRevenue;

            var todayManualIncome = transactions.Where(t => t.Type == TransactionType.CashIn || t.Type == TransactionType.MembershipPayment).Sum(t => t.Amount);
            var todayManualExpense = transactions.Where(t => t.Type == TransactionType.CashOut).Sum(t => t.Amount);

            // 5. Slots Libres (Desde ahora hasta las 24hs)
            var courts = await _context.Courts.Where(c => c.IsActive).ToListAsync();
            int freeSlots = 0;
            
            var nowLocal = todayUtc.AddHours(-3);
            var startHour = nowLocal.Hour;
            if (nowLocal.Date < calendarToday) startHour = 0;
            if (nowLocal.Date > calendarToday) startHour = 24;

            for (int h = Math.Max(startHour, 8); h < 24; h++) // De 8hs a 24hs
            {
                var slotStart = calendarToday.Date.AddHours(h); // Usar hoy comercial sin hora
                var slotEnd = slotStart.AddHours(1);

                foreach (var court in courts)
                {
                    bool isOccupied = todayBookingsList.Any(b => b.CourtId == court.Id && 
                                       b.StartTime < slotEnd && b.EndTime > slotStart);
                    if (!isOccupied) freeSlots++;
                }
            }

            // Totales para progreso mensual
            var monthlyRevenue = await _context.Bookings.Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= startOfMonth).SumAsync(b => b.Price)
                                 + await _context.SpaceBookings.Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= startOfMonth).SumAsync(b => b.Price);

            var monthlyGoalSetting = await _context.SystemSettings.FindAsync("MonthlyGoal");
            decimal monthlyGoal = decimal.TryParse(monthlyGoalSetting?.Value, out var goal) ? goal : 500000;
            
            var progress = monthlyGoal > 0 ? (monthlyRevenue / monthlyGoal) * 100 : 100;

            return Ok(new
            {
                totalRevenue = await _context.Bookings.Where(b => b.Status != BookingStatus.Cancelled).SumAsync(b => b.Price) 
                               + await _context.SpaceBookings.Where(b => b.Status != BookingStatus.Cancelled).SumAsync(b => b.Price),
                totalBookings = await _context.Bookings.CountAsync(b => b.Status != BookingStatus.Cancelled) 
                                + await _context.SpaceBookings.CountAsync(b => b.Status != BookingStatus.Cancelled),
                todayRevenue = todayActualPayments + todayManualIncome - todayManualExpense, // Ingreso neto real de la caja
                todayRentalsRevenue,
                todayConsumptionsRevenue,
                todayActualPayments,
                todayManualIncome,
                todayManualExpense,
                todayBookings = todayBookingsCount,
                todayBookingsRevenue,
                initialCash = latestClosure?.InitialCash ?? 0,
                todayBookingsList = todayBookingsList.Select(b => new {
                    b.Id,
                    b.Price,
                    b.StartTime,
                    b.EndTime,
                    b.Status,
                    b.GuestName,
                    Court = b.Court != null ? new { b.Court.Id, b.Court.Name } : null,
                    User = b.User != null ? new { b.User.Id, FullName = b.User.FullName } : null
                }).ToList(),
                todaySpaceBookingsList = todaySpaceBookingsList.Select(b => new {
                    b.Id,
                    b.Price,
                    b.StartTime,
                    b.EndTime,
                    b.Status,
                    b.GuestName,
                    Space = b.Space != null ? new { b.Space.Id, b.Space.Name } : null,
                    User = b.User != null ? new { b.User.Id, FullName = b.User.FullName } : null
                }).ToList(),
                monthlyRevenue,
                monthlyGoal,
                monthlyProgress = Math.Min(100, (int)progress),
                freeSlots,
                activeClosureOpeningDate = activeClosure?.OpeningDate,
                activeClosureOpenedBy = activeClosure?.OpenedBy,
                activeClosureIsOpen = activeClosure != null
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("revenue-stats")]
        public async Task<IActionResult> GetRevenueStats()
        {
            var todayLocal = DateTime.UtcNow.AddHours(-3).Date;
            var last7Days = Enumerable.Range(0, 7)
                .Select(i => todayLocal.AddDays(-i))
                .OrderBy(d => d)
                .ToList();

            var startDate = last7Days.First();

            var bookings = await _context.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= startDate)
                .ToListAsync();

            var spaceBookings = await _context.SpaceBookings
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= startDate)
                .ToListAsync();

            var stats = last7Days.Select(date => new
            {
                date = date.ToString("dd/MM"),
                revenue = bookings.Where(b => b.StartTime.Date == date.Date).Sum(b => b.Price) +
                          spaceBookings.Where(b => b.StartTime.Date == date.Date).Sum(b => b.Price)
            }).ToList();

            return Ok(stats);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("product-sales-daily")]
        public async Task<IActionResult> GetProductSalesDaily([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            DateTime filterStart;
            DateTime filterEnd;

            if (startDate == null && endDate == null)
            {
                var activeClosure = await _context.CashClosures
                    .Where(c => c.IsOpen)
                    .OrderByDescending(c => c.OpeningDate)
                    .FirstOrDefaultAsync();

                if (activeClosure != null)
                {
                    filterStart = activeClosure.OpeningDate;
                    filterEnd = filterStart.Date.AddDays(1).AddHours(6);
                }
                else
                {
                    filterStart = DateTime.UtcNow.AddHours(-3).Date;
                    filterEnd = filterStart.AddDays(1);
                }
            }
            else
            {
                filterStart = startDate?.Date ?? DateTime.UtcNow.AddHours(-3).Date;
                filterEnd = (endDate?.Date ?? filterStart).AddDays(1);
            }
            var filterStartUtc = filterStart.AddHours(3);
            var filterEndUtc = filterEnd.AddHours(3);
            
            var sales = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => c.CreatedAt >= filterStartUtc && c.CreatedAt < filterEndUtc &&
                           (c.Booking == null || c.Booking.Status != BookingStatus.Cancelled) &&
                           (c.SpaceBooking == null || c.SpaceBooking.Status != BookingStatus.Cancelled))
                .GroupBy(c => new { c.ProductId, c.Product.Name, c.Product.Category })
                .Select(g => new
                {
                    productId = g.Key.ProductId,
                    productName = g.Key.Name,
                    category = g.Key.Category,
                    totalQuantity = g.Sum(x => x.Quantity),
                    totalRevenue = g.Sum(x => x.UnitPrice * x.Quantity),
                    totalCost = g.Sum(x => x.Quantity * x.Product.CostPrice)
                })
                .OrderByDescending(x => x.totalQuantity)
                .ToListAsync();

            // Si no hay ventas hoy, devolvemos tambiÃ©n un resumen de los Ãºltimos 7 dÃ­as para que el usuario vea que hay datos
            if (!sales.Any() && startDate == null && endDate == null)
            {
                var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
                var recentSales = await _context.BookingConsumptions
                    .Include(c => c.Product)
                    .Include(c => c.Booking)
                    .Include(c => c.SpaceBooking)
                    .Where(c => c.CreatedAt >= sevenDaysAgo &&
                               (c.Booking == null || c.Booking.Status != BookingStatus.Cancelled) &&
                               (c.SpaceBooking == null || c.SpaceBooking.Status != BookingStatus.Cancelled))
                    .GroupBy(c => new { c.ProductId, c.Product.Name, c.Product.Category })
                    .Select(g => new
                    {
                        productId = g.Key.ProductId,
                        productName = g.Key.Name,
                        category = g.Key.Category,
                        totalQuantity = g.Sum(x => x.Quantity),
                        totalRevenue = g.Sum(x => x.UnitPrice * x.Quantity),
                        totalCost = g.Sum(x => x.Quantity * x.Product.CostPrice),
                        isRecentOnly = true
                    })
                    .OrderByDescending(x => x.totalQuantity)
                    .ToListAsync();
                
                return Ok(recentSales);
            }

            return Ok(sales);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("products-ranking-by-day")]
        public async Task<IActionResult> GetProductsRankingByDay([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var filterStart = startDate?.Date ?? DateTime.UtcNow.AddHours(-3).Date.AddDays(-30);
            var filterEnd = (endDate?.Date ?? DateTime.UtcNow.AddHours(-3).Date).AddDays(1);

            var filterStartUtc = filterStart.AddHours(3);
            var filterEndUtc = filterEnd.AddHours(3);

            var consumptions = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => c.CreatedAt >= filterStartUtc && c.CreatedAt < filterEndUtc &&
                           (c.Booking == null || c.Booking.Status != BookingStatus.Cancelled) &&
                           (c.SpaceBooking == null || c.SpaceBooking.Status != BookingStatus.Cancelled))
                .Select(c => new
                {
                    c.ProductId,
                    c.Product.Name,
                    c.Product.Category,
                    c.Quantity,
                    Date = c.CreatedAt.AddHours(-3) // Local time adjustment
                })
                .ToListAsync();

            var ranking = consumptions
                .GroupBy(c => new { c.ProductId, c.Name, c.Category })
                .Select(g =>
                {
                    var byDay = g.GroupBy(x => x.Date.DayOfWeek)
                                 .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

                    return new
                    {
                        productId = g.Key.ProductId,
                        productName = g.Key.Name,
                        category = g.Key.Category,
                        totalQuantity = g.Sum(x => x.Quantity),
                        monday = byDay.ContainsKey(DayOfWeek.Monday) ? byDay[DayOfWeek.Monday] : 0,
                        tuesday = byDay.ContainsKey(DayOfWeek.Tuesday) ? byDay[DayOfWeek.Tuesday] : 0,
                        wednesday = byDay.ContainsKey(DayOfWeek.Wednesday) ? byDay[DayOfWeek.Wednesday] : 0,
                        thursday = byDay.ContainsKey(DayOfWeek.Thursday) ? byDay[DayOfWeek.Thursday] : 0,
                        friday = byDay.ContainsKey(DayOfWeek.Friday) ? byDay[DayOfWeek.Friday] : 0,
                        saturday = byDay.ContainsKey(DayOfWeek.Saturday) ? byDay[DayOfWeek.Saturday] : 0,
                        sunday = byDay.ContainsKey(DayOfWeek.Sunday) ? byDay[DayOfWeek.Sunday] : 0
                    };
                })
                .OrderByDescending(x => x.totalQuantity)
                .ToList();

            return Ok(ranking);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stock-alerts")]
        public async Task<IActionResult> GetStockAlerts()
        {
            var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
            
            var recentSalesList = await _context.BookingConsumptions
                .Where(b => b.CreatedAt >= sevenDaysAgo)
                .GroupBy(b => b.ProductId)
                .Select(g => new { ProductId = g.Key, TotalQuantity = g.Sum(c => c.Quantity) })
                .ToListAsync();

            var recentSales = recentSalesList.ToDictionary(g => g.ProductId, g => g.TotalQuantity);

            var products = await _context.Products
                .Where(p => p.IsActive)
                .ToListAsync();

            var coverageSetting = await _context.SystemSettings.FindAsync("CoverageDays");
            int coverageDays = int.TryParse(coverageSetting?.Value, out var c) ? c : 4;

            var alerts = products
                .Select(p => {
                    var weeklySales = recentSales.ContainsKey(p.Id) ? recentSales[p.Id] : 0;
                    double dailySales = weeklySales / 7.0;
                    int targetStock = (int)Math.Ceiling(dailySales * coverageDays) + p.MinimumStock;
                    
                    var isCritical = p.Stock <= p.MinimumStock || p.Stock <= Math.Ceiling(dailySales * 2);
                    
                    return new {
                        p,
                        weeklySales,
                        dailySales,
                        targetStock,
                        isCritical
                    };
                })
                .Where(x => x.isCritical)
                .OrderBy(x => x.p.Stock)
                .Select(x => new
                {
                    id = x.p.Id,
                    name = x.p.Name,
                    category = x.p.Category,
                    stock = x.p.Stock,
                    minimumStock = x.p.MinimumStock,
                    weeklySales = x.weeklySales,
                    dailySales = (int)Math.Round(x.dailySales, MidpointRounding.AwayFromZero),
                    targetStock = x.targetStock,
                    needed = Math.Max(0, x.targetStock - x.p.Stock)
                })
                .Where(x => x.needed > 0)
                .ToList();

            return Ok(alerts);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("sales-by-closure")]
        public async Task<IActionResult> GetSalesByClosure([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int limit = 50)
        {
            var query = _context.CashClosures.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(c => c.OpeningDate >= startDate.Value);
            
            if (endDate.HasValue)
            {
                var endLimit = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(c => c.OpeningDate <= endLimit);
            }

            var closures = await query
                .OrderByDescending(c => c.OpeningDate)
                .Take(limit)
                .ToListAsync();

            var result = new List<object>();

            foreach (var closure in closures)
            {
                var start = closure.OpeningDate;
                var end = closure.ClosingDate ?? DateTime.UtcNow;

                var transactions = await _context.Transactions
                    .Where(t => t.Date >= start && t.Date <= end && (
                        t.Type == TransactionType.Payment || 
                        t.Type == TransactionType.MembershipPayment
                    ))
                    .ToListAsync();

                decimal rentalsTotal = 0;
                decimal consumptionsTotal = 0;

                foreach (var t in transactions)
                {
                    var desc = t.Description ?? "";
                    if (desc.Contains("Alquiler + Consumiciones", StringComparison.OrdinalIgnoreCase))
                    {
                        if (t.BookingId.HasValue)
                        {
                            var bookingCons = await _context.BookingConsumptions
                                .Where(c => c.BookingId == t.BookingId.Value)
                                .SumAsync(c => c.UnitPrice * c.Quantity);
                            var consAmount = Math.Min(t.Amount, bookingCons);
                            consumptionsTotal += consAmount;
                            rentalsTotal += (t.Amount - consAmount);
                        }
                        else
                        {
                            rentalsTotal += t.Amount;
                        }
                    }
                    else if (desc.Contains("Consumo", StringComparison.OrdinalIgnoreCase) || 
                             desc.Contains("Consumicion", StringComparison.OrdinalIgnoreCase) || 
                             desc.Contains("Venta Directa", StringComparison.OrdinalIgnoreCase) || 
                             desc.Contains("Cantina", StringComparison.OrdinalIgnoreCase))
                    {
                        consumptionsTotal += t.Amount;
                    }
                    else
                    {
                        rentalsTotal += t.Amount;
                    }
                }

                result.Add(new {
                    id = closure.Id,
                    openingDate = closure.OpeningDate,
                    closingDate = closure.ClosingDate,
                    openedBy = closure.OpenedBy,
                    isOpen = closure.IsOpen,
                    rentalsTotal,
                    consumptionsTotal,
                    totalRevenue = rentalsTotal + consumptionsTotal,
                    expectedCash = closure.ExpectedCash ?? 0,
                    actualCash = closure.ActualCash ?? 0,
                    difference = (closure.ActualCash ?? 0) - (closure.ExpectedCash ?? 0),
                    totalCashSales = closure.TotalCashSales ?? 0,
                    totalCardSales = closure.TotalCardSales ?? 0,
                    totalTransferSales = closure.TotalTransferSales ?? 0,
                    totalOtherSales = closure.TotalOtherSales ?? 0
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("closure-products/{closureId}")]
        public async Task<IActionResult> GetClosureProducts(int closureId)
        {
            var closure = await _context.CashClosures.FindAsync(closureId);
            if (closure == null) return NotFound();

            var startUtc = closure.OpeningDate.AddHours(3);
            var endUtc = (closure.ClosingDate?.AddHours(3) ?? DateTime.UtcNow);

            var sales = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Where(c => c.CreatedAt >= startUtc && c.CreatedAt <= endUtc)
                .GroupBy(c => new { c.ProductId, c.Product.Name, c.Product.Category })
                .Select(g => new
                {
                    productId = g.Key.ProductId,
                    productName = g.Key.Name,
                    category = g.Key.Category,
                    totalQuantity = g.Sum(x => x.Quantity),
                    totalRevenue = g.Sum(x => x.UnitPrice * x.Quantity)
                })
                .OrderByDescending(x => x.totalQuantity)
                .ToListAsync();

            return Ok(sales);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("products-matrix-by-closure")]
        public async Task<IActionResult> GetProductsMatrixByClosure([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int limit = 10)
        {
            var query = _context.CashClosures.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(c => c.OpeningDate >= startDate.Value);
            
            if (endDate.HasValue)
            {
                var endLimit = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(c => c.OpeningDate <= endLimit);
            }

            var closures = await query
                .OrderByDescending(c => c.OpeningDate)
                .Take(limit)
                .ToListAsync();

            if (!closures.Any())
            {
                return Ok(new { Closures = new List<object>(), Products = new List<object>() });
            }

            // Ordenar cronolÃ³gicamente de izquierda a derecha (mÃ¡s antiguos a mÃ¡s recientes)
            closures = closures.OrderBy(c => c.OpeningDate).ToList();

            var start = closures.Min(c => c.OpeningDate);
            var end = closures.Max(c => c.ClosingDate) ?? DateTime.UtcNow;

            var startUtc = start.AddHours(3);
            var endUtc = end.AddHours(3);

            var sales = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Where(c => c.CreatedAt >= startUtc && c.CreatedAt <= endUtc)
                .ToListAsync();

            var products = sales.GroupBy(s => s.ProductId)
                .Select(g => new
                {
                    productId = g.Key,
                    productName = g.First().Product.Name,
                    category = g.First().Product.Category,
                    totalQuantity = g.Sum(x => x.Quantity),
                    totalRevenue = g.Sum(x => x.UnitPrice * x.Quantity),
                    quantitiesByClosure = closures.ToDictionary(
                        c => c.Id.ToString(),
                        c => g.Where(x => x.CreatedAt >= c.OpeningDate.AddHours(3) && x.CreatedAt <= (c.ClosingDate?.AddHours(3) ?? DateTime.UtcNow)).Sum(x => x.Quantity)
                    )
                })
                .OrderByDescending(p => p.totalQuantity)
                .ToList();

            return Ok(new
            {
                closures = closures.Select(c => new { 
                    id = c.Id, 
                    label = $"Caja #{c.Id}", 
                    isOpen = c.IsOpen,
                    openedBy = c.OpenedBy,
                    date = c.OpeningDate.ToString("dd/MM")
                }),
                products = products
            });
        }
        [Authorize(Roles = "Admin,Staff,Cocinero")]
        [HttpGet("sales-by-category")]
        public async Task<IActionResult> GetSalesByCategory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var filterStartLocal = startDate?.Date ?? DateTime.UtcNow.AddHours(-3).Date;
            var filterEndLocal = (endDate?.Date ?? filterStartLocal).AddDays(1);
            
            var filterStartUtc = filterStartLocal.AddHours(3);
            var filterEndUtc = filterEndLocal.AddHours(3);

            var salesRaw = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => c.Product != null && c.CreatedAt >= filterStartUtc && c.CreatedAt < filterEndUtc)
                .ToListAsync();

            var sales = salesRaw
                .Where(c => (c.Booking == null || c.Booking.Status != BookingStatus.Cancelled) &&
                            (c.SpaceBooking == null || c.SpaceBooking.Status != BookingStatus.Cancelled))
                .GroupBy(c => string.IsNullOrEmpty(c.Product.Category) ? "Sin Categoría" : c.Product.Category)
                .Select(g => new
                {
                    category = g.Key,
                    totalQuantity = g.Sum(x => x.Quantity),
                    totalRevenue = g.Sum(x => x.UnitPrice * x.Quantity)
                })
                .OrderByDescending(x => x.totalRevenue)
                .ToList();

            return Ok(sales);
        }

        [Authorize(Roles = "Admin,Cocinero")]
        [HttpGet("kitchen-sales")]
        public async Task<IActionResult> GetKitchenSales([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var filterStartLocal = startDate?.Date ?? DateTime.UtcNow.AddHours(-3).Date;
            var filterEndLocal = (endDate?.Date ?? filterStartLocal).AddDays(1);

            var filterStartUtc = filterStartLocal.AddHours(3);
            var filterEndUtc = filterEndLocal.AddHours(3);

            var salesRaw = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => (c.Product.RecipeId != null || (c.Product.Category != null && c.Product.Category.ToLower() == "comida")) && c.CreatedAt >= filterStartUtc && c.CreatedAt < filterEndUtc)
                .ToListAsync();

            var sales = salesRaw
                .Where(c => (c.Booking == null || c.Booking.Status != BookingStatus.Cancelled) &&
                            (c.SpaceBooking == null || c.SpaceBooking.Status != BookingStatus.Cancelled))
                .Select(c => new
                {
                    date = c.CreatedAt.AddHours(-3).ToString("dd/MM/yyyy HH:mm"),
                    productName = c.Product.Name,
                    quantity = c.Quantity,
                    unitPrice = c.UnitPrice,
                    total = c.Quantity * c.UnitPrice,
                    stock = c.Product.Stock
                })
                .OrderByDescending(c => c.date)
                .ToList();

            return Ok(sales);
        }
    }
}

