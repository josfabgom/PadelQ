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
            // Ajuste para horario local (UTC-3) para que "Hoy" coincida con el usuario
            var todayUtc = DateTime.UtcNow;
            var today = todayUtc.AddHours(-3).Date; 
            var tomorrow = today.AddDays(1);
            var startOfMonth = new DateTime(today.Year, today.Month, 1);
            
            // 1. Reservas de Hoy (Filtramos en la base de datos para rendimiento)
            var todayBookingsList = await _context.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled && b.StartTime >= today && b.StartTime < tomorrow)
                .ToListAsync();

            var todaySpaceBookingsList = await _context.SpaceBookings
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
                var slotStart = today.AddHours(h);
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
                monthlyRevenue,
                monthlyGoal,
                monthlyProgress = Math.Min(100, (int)progress),
                freeSlots
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
        public async Task<IActionResult> GetProductSalesDaily([FromQuery] DateTime? date)
        {
            // Si no se especifica fecha, usamos hoy (en UTC para comparar con CreatedAt)
            // Para ser más precisos con el usuario local, podríamos recibir el offset,
            // pero por ahora compararemos el rango del día solicitado.
            
            var startDate = date?.Date ?? DateTime.Today;
            var endDate = startDate.AddDays(1);
            
            var sales = await _context.BookingConsumptions
                .Include(c => c.Product)
                .Include(c => c.Booking)
                .Include(c => c.SpaceBooking)
                .Where(c => c.CreatedAt >= startDate && c.CreatedAt < endDate &&
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
            if (!sales.Any() && date == null)
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

        [HttpGet("stock-alerts")]
        public async Task<IActionResult> GetStockAlerts()
        {
            var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

            // Obtenemos las ventas de la última semana agrupadas por producto
            var recentSales = await _context.BookingConsumptions
                .Where(c => c.CreatedAt >= sevenDaysAgo)
                .GroupBy(c => c.ProductId)
                .Select(g => new { ProductId = g.Key, WeeklyQuantity = g.Sum(x => x.Quantity) })
                .ToDictionaryAsync(x => x.ProductId, x => x.WeeklyQuantity);

            var products = await _context.Products
                .Where(p => p.IsActive)
                .ToListAsync();

            var alerts = products
                .Select(p => {
                    var weeklySales = recentSales.ContainsKey(p.Id) ? recentSales[p.Id] : 0;
                    // El cálculo inteligente: 
                    // Si el stock actual es menor al mínimo O el stock actual es menor a lo que se vende en una semana
                    var isCritical = p.Stock <= p.MinimumStock || p.Stock <= (weeklySales * 0.5); // alerta si queda menos de media semana de ventas
                    
                    return new {
                        p,
                        weeklySales,
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
                    // Sugerencia: Reponer para cubrir el mínimo + 1 semana de ventas promedio
                    needed = Math.Max(0, (x.p.MinimumStock - x.p.Stock) + x.weeklySales)
                })
                .Where(x => x.needed > 0)
                .ToList();

            return Ok(alerts);
        }
    }
}
