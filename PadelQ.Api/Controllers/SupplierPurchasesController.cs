using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/supplier-purchases")]
    [Authorize(Roles = "Admin")]
    public class SupplierPurchasesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public SupplierPurchasesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupplierPurchase>>> GetPurchases()
        {
            return await _context.SupplierPurchases
                .Include(p => p.Supplier)
                .Include(p => p.Items)
                .ThenInclude(i => i.Product)
                .OrderByDescending(p => p.PurchaseDate)
                .ToListAsync();
        }

        [HttpGet("suppliers")]
        public async Task<ActionResult<IEnumerable<Supplier>>> GetSuppliers()
        {
            return await _context.Suppliers.Where(s => s.IsActive).ToListAsync();
        }

        [HttpPost("suppliers")]
        public async Task<ActionResult<Supplier>> CreateSupplier([FromBody] Supplier supplier)
        {
            _context.Suppliers.Add(supplier);
            await _context.SaveChangesAsync();
            return Ok(supplier);
        }

        [HttpPost]
        public async Task<ActionResult<SupplierPurchase>> CreatePurchase([FromBody] SupplierPurchase purchase)
        {
            if (purchase.Items == null || !purchase.Items.Any())
            {
                return BadRequest("La compra debe tener al menos un artículo.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                purchase.CreatedAt = DateTime.UtcNow;
                _context.SupplierPurchases.Add(purchase);

                foreach (var item in purchase.Items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product != null)
                    {
                        int finalQuantity = item.Quantity;
                        string yieldNote = "";
                        if (product.PurchaseYield > 1)
                        {
                            finalQuantity = item.Quantity * product.PurchaseYield;
                            yieldNote = $" (Rinde: x{product.PurchaseYield})";
                        }

                        // Update stock
                        product.Stock += finalQuantity;
                        
                        // Update cost price (optional, but good practice)
                        if (item.UnitCost > 0)
                        {
                            product.CostPrice = item.UnitCost;
                        }

                        // Create stock movement record
                        _context.ProductStockMovements.Add(new ProductStockMovement
                        {
                            ProductId = item.ProductId,
                            Type = MovementType.Purchase,
                            Quantity = finalQuantity,
                            Note = $"Compra #{purchase.InvoiceNumber ?? purchase.Id.ToString()} - Prov: {purchase.SupplierId}{yieldNote}",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction(nameof(GetPurchases), new { id = purchase.Id }, purchase);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Error al procesar la compra: {ex.Message}");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePurchase(int id)
        {
            var purchase = await _context.SupplierPurchases
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (purchase == null) return NotFound();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var item in purchase.Items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product != null)
                    {
                        // Revert stock
                        int revertQuantity = item.Quantity;
                        if (product.PurchaseYield > 1)
                        {
                            revertQuantity = item.Quantity * product.PurchaseYield;
                        }
                        product.Stock -= revertQuantity;
                    }
                }

                _context.SupplierPurchases.Remove(purchase);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Error al eliminar la compra: {ex.Message}");
            }
        }
    }
}
