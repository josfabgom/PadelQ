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
            // Ajuste para horario local (UTC-3)
            var todayUtc = DateTime.UtcNow;
            var fallbackToday = todayUtc.AddHours(-3).Date; 
            
            // Buscar si hay alguna caja abierta activa en el sistema
            var activeClosure = await _context.CashClosures
                .Where(c => c.IsOpen)
                .OrderByDescending(c => c.OpeningDate)
                .FirstOrDefaultAsync();

            // Si hay una caja abierta, tomamos su fecha de apertura como el inicio del turno comercial
            var today = activeClosure?.OpeningDate ?? fallbackToday;
            
            // El turno comercial abarca hasta 6 horas después de finalizar el día de apertura de la caja (ej: hasta 6am del día siguiente)
            var tomorrow = activeClosure != null 
                ? today.Date.AddDays(1).AddHours(6) 
                : fallbackToday.AddDays(1);

            var startOfMonth = new DateTime(today.Year, today.Month, 1);
            
            // 1. Reservas de Hoy (Filtramos en la base de datos para rendimiento)
            var todayBookingsList = await _context.Bookings
                .Include(b => b.Court)
                .Include(b => b.User)
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= today && b.StartTime < tomorrow)
                .ToListAsync();

            var todaySpaceBookingsList = await _context.SpaceBookings
                .Include(b => b.Space)
                .Include(b => b.User)
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= today && b.StartTime < tomorrow)
                .ToListAsync();

            var todayBookingsCount = todayBookingsList.Count + todaySpaceBookingsList.Count;
            
            // 2. Ingreso del día (Lo alquilado)
            var todayRentalsRevenue = todayBookingsList.Sum(b => b.Price) + todaySpaceBookingsList.Sum(b => b.Price);

            // 3. Consumiciones del día (Solo de reservas ACTIVAS o ventas directas)
            var todayConsumptionsRevenue = await _context.BookingConsumptions
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => c.CreatedAt >= today && c.CreatedAt < tomorrow &&
                           (c.Booking == null || c.Booking.Status != BookingStatus.Cancelled) &&
                           (c.SpaceBooking == null || c.SpaceBooking.Status != BookingStatus.Cancelled))
                .SumAsync(c => c.UnitPrice * c.Quantity);

            // 4. Pagos Reales (Lo cobrado efectivamente hoy)
            var todayActualPayments = await _context.Transactions
                .Where(t => t.Date >= today && t.Date < tomorrow && (t.Type == TransactionType.Payment || t.Type == TransactionType.MembershipPayment || t.Type == TransactionType.CashIn || t.Type == TransactionType.CashOut))
                .SumAsync(t => (t.Type == TransactionType.CashOut ? -t.Amount : t.Amount));

            // 5. Slots Libres (Desde ahora hasta las 24hs)
            var courts = await _context.Courts.Where(c => c.IsActive).ToListAsync();
            int freeSlots = 0;
            
            var nowLocal = todayUtc.AddHours(-3);
            var startHour = nowLocal.Hour;
            if (nowLocal.Date < today) startHour = 0;
            if (nowLocal.Date > today) startHour = 24;

            for (int h = Math.Max(startHour, 8); h < 24; h++) // De 8hs a 24hs
            {
                var slotStart = today.Date.AddHours(h); // Usar hoy comercial sin hora
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
                todayRevenue = todayRentalsRevenue + todayConsumptionsRevenue,
                todayRentalsRevenue,
                todayConsumptionsRevenue,
                todayActualPayments,
                todayBookings = todayBookingsCount,
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
            
            var sales = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => c.CreatedAt >= filterStart && c.CreatedAt < filterEnd &&
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

            // Si no hay ventas hoy, devolvemos también un resumen de los últimos 7 días para que el usuario vea que hay datos
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

        [HttpGet("products-ranking-by-day")]
        public async Task<IActionResult> GetProductsRankingByDay([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var filterStart = startDate?.Date ?? DateTime.UtcNow.AddHours(-3).Date.AddDays(-30);
            var filterEnd = (endDate?.Date ?? DateTime.UtcNow.AddHours(-3).Date).AddDays(1);

            var consumptions = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => c.CreatedAt >= filterStart && c.CreatedAt < filterEnd &&
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
    }
}
