using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/products")]
    [Authorize(Roles = "Admin,Staff")]
    public class ProductsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProductsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            return await _context.Products
                .Where(p => p.IsActive)
                .OrderBy(p => p.Category)
                .ThenBy(p => p.Name)
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Product>> GetProduct(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound();
            return product;
        }

        [HttpPost]
        public async Task<ActionResult<Product>> CreateProduct([FromBody] Product product)
        {
            product.CreatedAt = DateTime.UtcNow;
            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] Product product)
        {
            if (id != product.Id) return BadRequest();
            _context.Entry(product).State = EntityState.Modified;
            _context.Entry(product).Property(x => x.CreatedAt).IsModified = false;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("movement")]
        public async Task<IActionResult> PostStockMovement([FromBody] ProductStockMovement movement)
        {
            var product = await _context.Products.FindAsync(movement.ProductId);
            if (product == null) return NotFound("Producto no encontrado");

            movement.CreatedAt = DateTime.UtcNow;
            _context.ProductStockMovements.Add(movement);

            // Update product stock
            product.Stock += movement.Quantity;
            
            await _context.SaveChangesAsync();
            return Ok(product);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound();

            // Soft delete
            product.IsActive = false;
            _context.Entry(product).State = EntityState.Modified;

            await _context.SaveChangesAsync();
            return NoContent();
        }
        [HttpPost("bulk-import")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> BulkImport()
        {
            var productsToImport = new List<(string Name, decimal Price, string? Barcode, string? Category)>
            {
                ("Pepsi Black lata 354ml", 2000, "7791813050056", "Bar"),
                ("Pepsi Regular / 7up lata", 2000, "7791813040057", "Bar"),
                ("Paso de los Toros lata", 2000, "7791813000525", "Bar"),
                ("H2O 500", 2500, "7791813080053", "Bar"),
                ("H2O 1,5L", 3500, "7791813080039", "Bar"),
                ("Gatorade 500ml", 3500, "7792170002054", "Bar"),
                ("Red Bull 250ml", 5000, "9002490100070", "Bar"),
                ("Pepsi 1.5L/paso/tonica", 4000, "7791813003267", "Bar"),
                ("Agua 1.5L", 2900, "7791199000100", "Bar"),
                ("Agua 1L sport", 2500, "7791199004450", "Bar"),
                ("Agua 500", 2000, "7791199000087", "Bar"),
                ("Chopp Stella 500ml", 5000, "CHOPP-STELLA-500", "Bar"),
                ("Chopp Patagonia", 5000, "CHOPP-PATA-500", "Bar"),
                ("Combo 2x1 CHOPP", 8000, "COMBO-CHOPP-2X1", "Combo"),
                ("Corona 330", 4500, "7501064191350", "Bar"),
                ("Combo Corona 6x5", 25000, "COMBO-CORONA-6X5", "Combo"),
                ("Corona 330 0%", 4500, "7792798013470", "Bar"),
                ("Corona 710", 7000, "7501064193071", "Bar"),
                ("Patagonia 730", 7000, "7792798000418", "Bar"),
                ("Stella 0.0%", 4500, "7792798013470", "Bar"),
                ("Michelob 275", 4500, "7792798010608", "Bar"),
                ("Budweisser 710", 5000, "7792798000128", "Bar"),
                ("Brahma 473", 3500, "7792798000333", "Bar"),
                ("Fernet con CoLa 800ml", 6000, "TRAGO-FERNET-COLA", "Bar"),
                ("Combo 2x1 Fernet", 9000, "COMBO-FERNET-2X1", "Combo"),
                ("grip odea", 3000, "7790000000001", "Accesorios"),
                ("pelotas odea x2", 10000, "7790000000002", "Accesorios"),
                ("Mani king salado", 1500, "7798114000001", "Kiosko")
            };

            int updated = 0;
            int created = 0;

            foreach (var item in productsToImport)
            {
                var existing = await _context.Products.FirstOrDefaultAsync(p => p.Name.ToLower() == item.Name.ToLower());
                if (existing != null)
                {
                    existing.FinalPrice = item.Price;
                    existing.Barcode = item.Barcode ?? existing.Barcode;
                    existing.Category = item.Category ?? existing.Category;
                    updated++;
                }
                else
                {
                    _context.Products.Add(new Product
                    {
                        Name = item.Name,
                        FinalPrice = item.Price,
                        Barcode = item.Barcode,
                        Category = item.Category ?? "Bar",
                        Stock = 0,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    });
                    created++;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Importación completada", Updated = updated, Created = created });
        }
    }
}
