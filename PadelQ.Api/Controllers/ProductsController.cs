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
    }
}
