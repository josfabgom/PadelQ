using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PadelQ.Api.Hubs;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/kitchen-orders")]
    [Authorize(Roles = "Admin,Cocinero,Staff")]
    public class KitchenOrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<KitchenHub> _kitchenHub;

        public KitchenOrdersController(ApplicationDbContext context, IHubContext<KitchenHub> kitchenHub)
        {
            _context = context;
            _kitchenHub = kitchenHub;
        }

        [HttpGet("active")]
        public async Task<IActionResult> GetActiveOrders()
        {
            var activeStatuses = new[] { KitchenOrderStatus.Pending, KitchenOrderStatus.Preparing, KitchenOrderStatus.Ready };
            
            var orders = await _context.KitchenOrders
                .Include(ko => ko.Items)
                    .ThenInclude(i => i.Product)
                .Where(ko => activeStatuses.Contains(ko.Status))
                .OrderBy(ko => ko.CreatedAt)
                .Select(ko => new
                {
                    ko.Id,
                    ko.OrderNumber,
                    Status = ko.Status.ToString(),
                    ko.BookingId,
                    ko.SpaceBookingId,
                    ko.CustomerName,
                    CreatedAt = ko.CreatedAt,
                    Items = ko.Items.Select(i => new
                    {
                        i.ProductId,
                        ProductName = i.Product != null ? i.Product.Name : "Desconocido",
                        i.Quantity,
                        i.Notes
                    })
                })
                .ToListAsync();

            return Ok(orders);
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var historyStatuses = new[] { KitchenOrderStatus.Delivered, KitchenOrderStatus.Cancelled };
            
            var query = _context.KitchenOrders
                .Include(ko => ko.Items)
                    .ThenInclude(i => i.Product)
                .Where(ko => historyStatuses.Contains(ko.Status));

            if (startDate.HasValue)
            {
                var start = startDate.Value.Date;
                query = query.Where(ko => (ko.CompletedAt ?? ko.CreatedAt) >= start);
            }
            if (endDate.HasValue)
            {
                var end = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(ko => (ko.CompletedAt ?? ko.CreatedAt) <= end);
            }

            var orders = await query
                .OrderByDescending(ko => ko.CompletedAt ?? ko.CreatedAt)
                .Take(100)
                .Select(ko => new
                {
                    ko.Id,
                    ko.OrderNumber,
                    Status = ko.Status.ToString(),
                    ko.BookingId,
                    ko.SpaceBookingId,
                    ko.CustomerName,
                    CreatedAt = ko.CreatedAt,
                    CompletedAt = ko.CompletedAt,
                    Items = ko.Items.Select(i => new
                    {
                        i.ProductId,
                        ProductName = i.Product != null ? i.Product.Name : "Desconocido",
                        i.Quantity,
                        i.Notes
                    })
                })
                .ToListAsync();

            return Ok(orders);
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateKitchenOrderStatusRequest request)
        {
            var order = await _context.KitchenOrders.FindAsync(id);
            if (order == null) return NotFound("Comanda no encontrada");

            if (Enum.TryParse<KitchenOrderStatus>(request.Status, true, out var newStatus))
            {
                var oldStatus = order.Status;
                order.Status = newStatus;
                
                if (newStatus == KitchenOrderStatus.Delivered || newStatus == KitchenOrderStatus.Cancelled)
                {
                    order.CompletedAt = DateTime.UtcNow;
                }

                var audit = new KitchenOrderAudit
                {
                    KitchenOrderId = order.Id,
                    FromStatus = oldStatus,
                    ToStatus = newStatus,
                    ChangedBy = User.Identity?.Name ?? "Sistema"
                };
                _context.KitchenOrderAudits.Add(audit);

                await _context.SaveChangesAsync();

                // Notify all clients about status change
                await _kitchenHub.Clients.Group("Cocineros").SendAsync("OrderStatusChanged", new
                {
                    order.Id,
                    Status = order.Status.ToString(),
                    CompletedAt = order.CompletedAt
                });

                return Ok(new { order.Id, Status = order.Status.ToString() });
            }

            return BadRequest("Estado inválido");
        }

        [HttpGet("{id}/audit")]
        public async Task<IActionResult> GetAudit(Guid id)
        {
            var audits = await _context.KitchenOrderAudits
                .Where(a => a.KitchenOrderId == id)
                .OrderBy(a => a.ChangedAt)
                .Select(a => new
                {
                    a.Id,
                    FromStatus = a.FromStatus.HasValue ? a.FromStatus.ToString() : "Created",
                    ToStatus = a.ToStatus.ToString(),
                    a.ChangedBy,
                    a.ChangedAt
                })
                .ToListAsync();

            return Ok(audits);
        }
    }

    public class UpdateKitchenOrderStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }
}
