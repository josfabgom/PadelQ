using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/ingredients")]
    [Authorize(Roles = "Admin,Staff")]
    public class IngredientsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public IngredientsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Ingredient>>> GetIngredients()
        {
            return await _context.Ingredients
                .Where(i => i.IsActive)
                .OrderBy(i => i.Name)
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Ingredient>> GetIngredient(int id)
        {
            var ingredient = await _context.Ingredients.FindAsync(id);
            if (ingredient == null || !ingredient.IsActive) return NotFound();
            return ingredient;
        }

        [HttpPost]
        public async Task<ActionResult<Ingredient>> CreateIngredient([FromBody] Ingredient ingredient)
        {
            ingredient.CreatedAt = DateTime.UtcNow;
            _context.Ingredients.Add(ingredient);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetIngredient), new { id = ingredient.Id }, ingredient);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateIngredient(int id, [FromBody] Ingredient ingredient)
        {
            if (id != ingredient.Id) return BadRequest();
            
            var existing = await _context.Ingredients.FindAsync(id);
            if (existing == null) return NotFound();

            _context.Entry(existing).CurrentValues.SetValues(ingredient);
            _context.Entry(existing).Property(x => x.CreatedAt).IsModified = false;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteIngredient(int id)
        {
            var ingredient = await _context.Ingredients.FindAsync(id);
            if (ingredient == null) return NotFound();

            ingredient.IsActive = false;
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
