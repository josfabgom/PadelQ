using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using PadelQ.Api.Hubs;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/consumptions")]
    [Authorize(Roles = "Admin,Staff")]
    public class ConsumptionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<KitchenHub> _kitchenHub;

        public ConsumptionsController(ApplicationDbContext context, UserManager<ApplicationUser> userManager, IHubContext<KitchenHub> kitchenHub)
        {
            _context = context;
            _userManager = userManager;
            _kitchenHub = kitchenHub;
        }

        [HttpGet("booking/{bookingId}")]
        public async Task<ActionResult<IEnumerable<BookingConsumption>>> GetByBooking(Guid bookingId)
        {
            return await _context.BookingConsumptions
                .Include(c => c.Product)
                .Where(c => c.BookingId == bookingId || c.SpaceBookingId == bookingId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();
        }

        [HttpGet("user/{userId}/pending")]
        public async Task<ActionResult<IEnumerable<BookingConsumption>>> GetByUserPending(string userId)
        {
            return await _context.BookingConsumptions
                .Include(c => c.Product)
                .Where(c => c.UserId == userId && !c.IsPaid)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();
        }

        [HttpGet("debtors")]
        public async Task<ActionResult> GetDebtors()
        {
            var debtors = await _context.BookingConsumptions
                .Where(c => !c.IsPaid && !string.IsNullOrEmpty(c.UserId))
                .GroupBy(c => new { c.UserId, FullName = c.User != null ? c.User.FullName : "Cliente Desconocido" })
                .Select(g => new
                {
                    UserId = g.Key.UserId,
                    FullName = g.Key.FullName,
                    TotalDebt = g.Sum(c => c.UnitPrice * (decimal)c.Quantity - c.DepositPaid)
                })
                .Where(d => d.TotalDebt > 0)
                .ToListAsync();

            return Ok(debtors);
        }

        [HttpGet("user/{userId}/unpaid-total")]
        public async Task<ActionResult<decimal>> GetUserUnpaidTotal(string userId)
        {
            return await _context.BookingConsumptions
                .Where(c => c.UserId == userId && !c.IsPaid)
                .SumAsync(c => c.UnitPrice * (decimal)c.Quantity - c.DepositPaid);
        }

        [HttpPost]
        public async Task<ActionResult<BookingConsumption>> AddConsumption([FromBody] AddConsumptionRequest request)
        {
            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null) return NotFound("Producto no encontrado");

            // Detectar si el ID es de una reserva normal o de espacio
            bool isNormalBooking = await _context.Bookings.AnyAsync(b => b.Id == request.BookingId);
            bool isSpaceBooking = !isNormalBooking && await _context.SpaceBookings.AnyAsync(sb => sb.Id == request.BookingId);

            if (!isNormalBooking && !isSpaceBooking)
            {
                return NotFound("Reserva no encontrada");
            }

            var consumption = new BookingConsumption
            {
                BookingId = isNormalBooking ? request.BookingId : null,
                SpaceBookingId = isSpaceBooking ? request.BookingId : null,
                ProductId = request.ProductId,
                Quantity = request.Quantity,
                UnitPrice = product.FinalPrice,
                Notes = request.Notes
            };

            // Stock Control
            await ApplyStockDeductionAsync(product, request.Quantity, $"Venta en {(isNormalBooking ? "Reserva" : "Espacio")} {request.BookingId}");

            _context.BookingConsumptions.Add(consumption);

            // Si estaba pagada, volver a estado Confirmado para que aparezca como pendiente
            if (isNormalBooking)
            {
                var b = await _context.Bookings.FindAsync(request.BookingId);
                if (b != null && b.Status == BookingStatus.Paid) b.Status = BookingStatus.Confirmed;
            }
            else if (isSpaceBooking)
            {
                var sb = await _context.SpaceBookings.FindAsync(request.BookingId);
                if (sb != null && sb.Status == BookingStatus.Paid) sb.Status = BookingStatus.Confirmed;
            }

            await _context.SaveChangesAsync();

            await CheckAndCreateKitchenOrderAsync(new List<BookingConsumption> { consumption }, request.CustomerName);

            return Ok(consumption);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteConsumption(Guid id)
        {
            var consumption = await _context.BookingConsumptions.FindAsync(id);
            if (consumption == null) return NotFound();

            if (consumption.IsPaid)
                return BadRequest("No se puede eliminar un consumo que ya ha sido pagado.");

            // Verificar si el turno ya está cerrado/pagado
            if (consumption.BookingId.HasValue)
            {
                var booking = await _context.Bookings.FindAsync(consumption.BookingId.Value);
                if (booking != null && booking.Status == BookingStatus.Paid)
                    return BadRequest("No se puede eliminar consumos de un turno que ya ha sido pagado completamente.");
            }
            else if (consumption.SpaceBookingId.HasValue)
            {
                var sbooking = await _context.SpaceBookings.FindAsync(consumption.SpaceBookingId.Value);
                if (sbooking != null && sbooking.Status == BookingStatus.Paid)
                    return BadRequest("No se puede eliminar consumos de un alquiler de espacio que ya ha sido pagado completamente.");
            }

            var product = await _context.Products.FindAsync(consumption.ProductId);
            if (product != null)
            {
                await ApplyStockDeductionAsync(product, -consumption.Quantity, $"Devolución/Borrado en Reserva {consumption.BookingId}");
                if (product.IsDoubleUnitCombo && consumption.IsComboRedeemed)
                {
                    await ApplyStockDeductionAsync(product, -consumption.Quantity, $"Devolución de 2da Unidad Combo {consumption.BookingId}");
                }
            }

            var kitchenOrderItems = await _context.KitchenOrderItems
                .Include(koi => koi.KitchenOrder)
                .Where(koi => koi.BookingConsumptionId == id)
                .ToListAsync();

            foreach (var item in kitchenOrderItems)
            {
                _context.KitchenOrderItems.Remove(item);
                
                var order = item.KitchenOrder;
                if (order != null)
                {
                    var otherItemsCount = await _context.KitchenOrderItems
                        .CountAsync(koi => koi.KitchenOrderId == order.Id && koi.Id != item.Id);
                    
                    if (otherItemsCount == 0)
                    {
                        var audits = await _context.KitchenOrderAudits.Where(a => a.KitchenOrderId == order.Id).ToListAsync();
                        _context.KitchenOrderAudits.RemoveRange(audits);
                        _context.KitchenOrders.Remove(order);
                    }
                }
            }

            _context.BookingConsumptions.Remove(consumption);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("bulk-direct-sale")]
        public async Task<IActionResult> BulkDirectSale([FromBody] BulkDirectSaleRequest request)
        {
            if (request.Items == null || !request.Items.Any()) return BadRequest("No hay items para vender");

            var consumptions = new List<BookingConsumption>();
            decimal totalAmount = 0;

            var itemDescriptions = new List<string>();

            foreach (var item in request.Items)
            {
                var product = await _context.Products.FindAsync(item.ProductId);
                if (product == null) continue;

                decimal finalPrice = product.FinalPrice;
                var discountAppliedStr = "";

                if (!string.IsNullOrEmpty(request.UserId))
                {
                    var targetUser = await _userManager.FindByIdAsync(request.UserId);
                    if (targetUser != null && (await _userManager.IsInRoleAsync(targetUser, "Staff")))
                    {
                        var setting = await _context.SystemSettings.FindAsync("EmployeeDiscountPercentage");
                        if (setting != null && decimal.TryParse(setting.Value, out decimal discountPct) && discountPct > 0)
                        {
                            finalPrice = finalPrice * (1.0m - (discountPct / 100.0m));
                            discountAppliedStr = $" (Descuento {discountPct:0.##}%)";
                        }
                    }
                }

                var consumption = new BookingConsumption
                {
                    UserId = string.IsNullOrWhiteSpace(request.UserId) ? null : request.UserId,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    UnitPrice = finalPrice,
                    IsPaid = request.IsPaid || request.IsInternal,
                    DepositPaid = (request.IsPaid || request.IsInternal) ? (item.PaidAmount ?? (finalPrice * item.Quantity)) : 0,
                    Notes = !string.IsNullOrWhiteSpace(item.Notes) ? item.Notes : (request.Notes ?? "Venta Directa unificada")
                };

                if (consumption.IsPaid && consumption.DepositPaid < consumption.TotalPrice)
                {
                    consumption.IsPaid = false; // Mark as pending if not fully paid
                }

                totalAmount += consumption.DepositPaid;
                consumptions.Add(consumption);

                itemDescriptions.Add($"{product.Name} x{item.Quantity}");

                // Stock Control
                string note = request.IsInternal ? $"Consumo Interno: {product.Name}" : (request.IsPaid ? $"Venta Directa Bulk: {product.Name} (Pagado){discountAppliedStr}" : $"Venta Directa Bulk: {product.Name} (PENDIENTE){discountAppliedStr}");
                await ApplyStockDeductionAsync(product, item.Quantity, note);
            }

            var itemsSummary = itemDescriptions.Any() ? string.Join(", ", itemDescriptions) : "Bulk";

            // Registrar pagos si es venta pagada
            if (request.IsPaid && !request.IsInternal)
            {
                if (request.SplitPayments != null && request.SplitPayments.Any())
                {
                    foreach (var payment in request.SplitPayments)
                    {
                        var transaction = new Transaction
                        {
                            UserId = string.IsNullOrWhiteSpace(request.UserId) ? null : request.UserId,
                            Amount = payment.Amount,
                            Date = TimeZoneHelper.GetArgNow(),
                            Type = TransactionType.Payment,
                            Description = $"Venta Directa (Pago Dividido): {itemsSummary}",
                            PaymentMethodId = payment.PaymentMethodId,
                            ProcessedBy = User.Identity?.Name ?? "Admin"
                        };
                        _context.Transactions.Add(transaction);
                    }
                }
                else if (request.PaymentMethodId.HasValue)
                {
                    var transaction = new Transaction
                    {
                        UserId = string.IsNullOrWhiteSpace(request.UserId) ? null : request.UserId,
                        Amount = totalAmount,
                        Date = TimeZoneHelper.GetArgNow(),
                        Type = TransactionType.Payment,
                        Description = $"Venta Directa: {itemsSummary}",
                        PaymentMethodId = request.PaymentMethodId.Value,
                        ProcessedBy = User.Identity?.Name ?? "Admin"
                    };
                    _context.Transactions.Add(transaction);
                }
            }

            _context.BookingConsumptions.AddRange(consumptions);
            await _context.SaveChangesAsync();
            
            await CheckAndCreateKitchenOrderAsync(consumptions, request.CustomerName);

            return Ok(new { Message = "Venta bulk procesada", Total = totalAmount, ItemsCount = consumptions.Count });
        }

        [HttpPost("direct-sale")]
        public async Task<IActionResult> DirectSale([FromBody] DirectSaleRequest request)
        {
            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null) return NotFound("Producto no encontrado");

            decimal finalPrice = product.FinalPrice;
            var discountAppliedStr = "";

            if (!string.IsNullOrEmpty(request.UserId))
            {
                var targetUser = await _userManager.FindByIdAsync(request.UserId);
                if (targetUser != null && (await _userManager.IsInRoleAsync(targetUser, "Staff")))
                {
                    var setting = await _context.SystemSettings.FindAsync("EmployeeDiscountPercentage");
                    if (setting != null && decimal.TryParse(setting.Value, out decimal discountPct) && discountPct > 0)
                    {
                        finalPrice = finalPrice * (1.0m - (discountPct / 100.0m));
                        discountAppliedStr = $" (Descuento {discountPct:0.##}%)";
                    }
                }
            }

            var consumption = new BookingConsumption
            {
                UserId = string.IsNullOrWhiteSpace(request.UserId) ? null : request.UserId,
                ProductId = request.ProductId,
                Quantity = request.Quantity,
                UnitPrice = finalPrice,
                IsPaid = request.IsPaid || request.IsInternal,
                Notes = request.Notes
            };

            if (request.IsInternal)
            {
                consumption.DepositPaid = consumption.TotalPrice;
            }
            else if (request.IsPaid)
            {
                consumption.DepositPaid = consumption.TotalPrice;

                
                if (request.PaymentMethodId.HasValue)
                {
                    var transaction = new Transaction
                    {
                        UserId = string.IsNullOrWhiteSpace(request.UserId) ? null : request.UserId,
                        Amount = consumption.TotalPrice,
                        Date = TimeZoneHelper.GetArgNow(),
                        Type = TransactionType.Payment,
                        Description = $"Venta Directa: {product.Name} x{request.Quantity}{discountAppliedStr}",
                        PaymentMethodId = request.PaymentMethodId.Value,
                        ProcessedBy = User.Identity?.Name ?? "Admin"
                    };
                    _context.Transactions.Add(transaction);
                }
            }

            // Stock Control
            string note = request.IsInternal ? $"Consumo Interno: {product.Name}" : (request.IsPaid ? $"Venta Directa: {product.Name} (Pagado){discountAppliedStr}" : $"Venta Directa: {product.Name} (PENDIENTE){discountAppliedStr}");
            await ApplyStockDeductionAsync(product, request.Quantity, note);

            _context.BookingConsumptions.Add(consumption);
            await _context.SaveChangesAsync();
            
            await CheckAndCreateKitchenOrderAsync(new List<BookingConsumption> { consumption }, request.CustomerName);

            return Ok(consumption);
        }

        [HttpPost("pay-pending/{userId}")]
        public async Task<IActionResult> PayPending(string userId, [FromBody] BulkPayPendingRequest request)
        {
            var pending = await _context.BookingConsumptions
                .Where(c => c.UserId == userId && !c.IsPaid)
                .ToListAsync();

            if (!pending.Any()) return BadRequest("No hay consumos pendientes");

            decimal totalDebt = pending.Sum(c => c.TotalPrice - c.DepositPaid);

            if (request.SplitPayments != null && request.SplitPayments.Any())
            {
                foreach (var payment in request.SplitPayments)
                {
                    var transaction = new Transaction
                    {
                        UserId = userId,
                        Amount = payment.Amount,
                        Date = TimeZoneHelper.GetArgNow(),
                        Type = TransactionType.Payment,
                        Description = $"Pago de Deuda (Dividido) - Consumiciones",
                        PaymentMethodId = payment.PaymentMethodId,
                        ProcessedBy = User.Identity?.Name ?? "Admin"
                    };
                    _context.Transactions.Add(transaction);
                }
            }
            else if (request.PaymentMethodId.HasValue)
            {
                var transaction = new Transaction
                {
                    UserId = userId,
                    Amount = totalDebt,
                    Date = TimeZoneHelper.GetArgNow(),
                    Type = TransactionType.Payment,
                    Description = $"Pago de Deuda - Consumiciones",
                    PaymentMethodId = request.PaymentMethodId.Value,
                    ProcessedBy = User.Identity?.Name ?? "Admin"
                };
                _context.Transactions.Add(transaction);
            }

            foreach (var c in pending)
            {
                c.IsPaid = true;
                c.DepositPaid = c.TotalPrice;
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Deuda pagada", TotalPaid = totalDebt });
        }

        [HttpPost("checkout/{bookingId}")]
        public async Task<IActionResult> Checkout(Guid bookingId, [FromQuery] int paymentMethodId)
        {
            var booking = await _context.Bookings.FindAsync(bookingId);
            if (booking == null) return NotFound("Reserva no encontrada");

            var consumptions = await _context.BookingConsumptions
                .Where(c => c.BookingId == bookingId)
                .ToListAsync();

            decimal totalConsumptions = consumptions.Sum(c => c.TotalPrice);
            decimal totalToPay = (booking.Price - booking.DepositPaid) + totalConsumptions;

            if (totalToPay > 0)
            {
                var method = await _context.PaymentMethods.FindAsync(paymentMethodId);
                string description = $"Pago Total (Alquiler + Consumiciones) - {method?.Name ?? "Efectivo"}";

                if (!string.IsNullOrEmpty(booking.UserId))
                {
                    var transaction = new Transaction
                    {
                        UserId = booking.UserId,
                        Amount = totalToPay,
                        Date = TimeZoneHelper.GetArgNow(),
                        Type = TransactionType.Payment,
                        Description = description,
                        PaymentMethodId = paymentMethodId,
                        ProcessedBy = User.Identity?.Name ?? "Admin",
                        BookingId = bookingId
                    };
                    _context.Transactions.Add(transaction);
                }
            }

            // Mark as fully paid
            booking.DepositPaid = booking.Price;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Checkout completado con éxito", TotalPaid = totalToPay });
        }

        [HttpPut("{id}/pay")]
        public async Task<IActionResult> MarkAsPaid(Guid id)
        {
            var consumption = await _context.BookingConsumptions.FindAsync(id);
            if (consumption == null) return NotFound();

            consumption.DepositPaid = consumption.TotalPrice;
            consumption.IsPaid = true;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPost("{id}/partial-pay")]
        public async Task<IActionResult> PartialPay(Guid id, [FromQuery] decimal amount)
        {
            var consumption = await _context.BookingConsumptions.FindAsync(id);
            if (consumption == null) return NotFound();

            consumption.DepositPaid += amount;
            if (consumption.DepositPaid >= consumption.TotalPrice)
            {
                consumption.IsPaid = true;
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Pago parcial de consumo registrado", DepositPaid = consumption.DepositPaid });
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPut("{id}/toggle-combo-redeem")]
        public async Task<IActionResult> ToggleComboRedeem(Guid id)
        {
            var consumption = await _context.BookingConsumptions
                .Include(c => c.Product)
                .FirstOrDefaultAsync(c => c.Id == id);
                
            if (consumption == null) return NotFound("Consumo no encontrado");
            if (consumption.Product == null || !consumption.Product.IsDoubleUnitCombo)
            {
                return BadRequest("Este consumo no corresponde a un combo de doble unidad.");
            }

            consumption.IsComboRedeemed = !consumption.IsComboRedeemed;
            
            int modifier = consumption.IsComboRedeemed ? 1 : -1;
            string note = modifier > 0 ? $"Canje de 2da Unidad Combo {consumption.BookingId}" : $"Deshacer canje Combo {consumption.BookingId}";
            await ApplyStockDeductionAsync(consumption.Product, consumption.Quantity * modifier, note);
            
            await _context.SaveChangesAsync();

            return Ok(new { isComboRedeemed = consumption.IsComboRedeemed });
        }

        [Authorize(Roles = "Admin,Staff")]
        [HttpPut("{id}/fractions")]
        public async Task<IActionResult> UpdateFractions(Guid id, [FromBody] UpdateFractionsRequest request)
        {
            var consumption = await _context.BookingConsumptions.FindAsync(id);
            if (consumption == null) return NotFound();
            
            consumption.Fractions = request.Fractions;
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Fracciones actualizadas" });
        }
        private async Task ApplyStockDeductionAsync(Product product, int quantity, string note)
        {
            if (product.RecipeId.HasValue)
            {
                var recipeItems = await _context.RecipeIngredients.Where(r => r.RecipeId == product.RecipeId).ToListAsync();
                foreach (var item in recipeItems)
                {
                    var baseIngredient = await _context.Ingredients.FindAsync(item.IngredientId);
                    if (baseIngredient != null)
                    {
                        decimal deductQuantity = quantity * item.Quantity;
                        baseIngredient.Stock -= deductQuantity;
                    }
                }
            }
            else
            {
                product.Stock -= quantity;
                _context.ProductStockMovements.Add(new ProductStockMovement
                {
                    ProductId = product.Id,
                    Type = quantity >= 0 ? MovementType.Sale : MovementType.Adjustment,
                    Quantity = -quantity,
                    Note = note
                });
            }
        }

        private async Task CheckAndCreateKitchenOrderAsync(List<BookingConsumption> consumptions, string? customerName)
        {
            var kitchenItems = new List<KitchenOrderItem>();
            
            // Check which consumptions are food
            foreach (var consumption in consumptions)
            {
                var product = await _context.Products.FindAsync(consumption.ProductId);
                if (product != null && (product.RecipeId.HasValue || (product.Category != null && product.Category.ToLower() == "comida")))
                {
                    kitchenItems.Add(new KitchenOrderItem
                    {
                        BookingConsumptionId = consumption.Id,
                        ProductId = consumption.ProductId,
                        Quantity = consumption.Quantity,
                        Notes = consumption.Notes
                    });
                }
            }

            if (kitchenItems.Any())
            {
                var firstConsumption = consumptions.First();
                var kitchenOrder = new KitchenOrder
                {
                    BookingId = firstConsumption.BookingId,
                    SpaceBookingId = firstConsumption.SpaceBookingId,
                    UserId = firstConsumption.UserId,
                    CustomerName = customerName,
                    Items = kitchenItems
                };

                _context.KitchenOrders.Add(kitchenOrder);
                
                var audit = new KitchenOrderAudit
                {
                    KitchenOrder = kitchenOrder,
                    FromStatus = null,
                    ToStatus = KitchenOrderStatus.Pending,
                    ChangedBy = User.Identity?.Name ?? "Sistema"
                };
                _context.KitchenOrderAudits.Add(audit);
                
                await _context.SaveChangesAsync();

                // Load product details for the notification
                var orderToNotify = await _context.KitchenOrders
                    .Include(ko => ko.Items)
                        .ThenInclude(i => i.Product)
                    .FirstOrDefaultAsync(ko => ko.Id == kitchenOrder.Id);

                if (orderToNotify != null)
                {
                    var notificationData = new
                    {
                        orderToNotify.Id,
                        orderToNotify.OrderNumber,
                        Status = orderToNotify.Status.ToString(),
                        orderToNotify.BookingId,
                        orderToNotify.SpaceBookingId,
                        orderToNotify.CustomerName,
                        CreatedAt = orderToNotify.CreatedAt.ToString("o"),
                        Items = orderToNotify.Items.Select(i => new 
                        { 
                            i.ProductId,
                            i.Quantity, 
                            i.Notes,
                            ProductName = i.Product?.Name
                        })
                    };

                    await _kitchenHub.Clients.Group("Cocineros").SendAsync("NewOrder", notificationData);
                }
            }
        }
    }

    public class AddConsumptionRequest
    {
        public Guid BookingId { get; set; }
        public int ProductId { get; set; }
        public int Quantity { get; set; }
        public string? Notes { get; set; }
        public string? CustomerName { get; set; }
    }

    public class DirectSaleRequest
    {
        public string UserId { get; set; } = string.Empty;
        public int ProductId { get; set; }
        public int Quantity { get; set; }
        public bool IsPaid { get; set; }
        public bool IsInternal { get; set; }
        public int? PaymentMethodId { get; set; }
        public string? Notes { get; set; }
        public string? CustomerName { get; set; }
    }

    public class BulkDirectSaleRequest
    {
        public string UserId { get; set; } = string.Empty;
        public List<DirectSaleItemRequest> Items { get; set; } = new();
        public bool IsPaid { get; set; }
        public bool IsInternal { get; set; }
        public int? PaymentMethodId { get; set; }
        public List<SplitPaymentRequest>? SplitPayments { get; set; }
        public string? Notes { get; set; }
        public string? CustomerName { get; set; }
    }

    public class BulkPayPendingRequest
    {
        public int? PaymentMethodId { get; set; }
        public List<SplitPaymentRequest>? SplitPayments { get; set; }
    }

    public class DirectSaleItemRequest
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
        public decimal? PaidAmount { get; set; }
        public string? Notes { get; set; }
    }

    public class SplitPaymentRequest
    {
        public int PaymentMethodId { get; set; }
        public decimal Amount { get; set; }
    }
}
