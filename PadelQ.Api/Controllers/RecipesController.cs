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
    [Route("api/recipes")]
    [Authorize(Roles = "Admin,Staff,Cocinero")]
    public class RecipesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public RecipesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Recipe>>> GetRecipes()
        {
            var recipes = await _context.Recipes
                .Include(r => r.RecipeIngredients)
                .Where(r => r.IsActive)
                .OrderBy(r => r.Name)
                .ToListAsync();

            var recipeIds = recipes.Select(r => r.Id).ToList();
            var products = await _context.Products
                .Where(p => p.RecipeId != null && recipeIds.Contains(p.RecipeId.Value) && p.IsActive)
                .ToDictionaryAsync(p => p.RecipeId.Value);

            foreach (var recipe in recipes)
            {
                if (products.TryGetValue(recipe.Id, out var product))
                {
                    recipe.CreateProductForSale = true;
                    recipe.FinalPrice = product.FinalPrice;
                }
            }

            return recipes;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Recipe>> GetRecipe(int id)
        {
            var recipe = await _context.Recipes
                .Include(r => r.RecipeIngredients)
                .FirstOrDefaultAsync(r => r.Id == id);
            
            if (recipe == null || !recipe.IsActive) return NotFound();

            var product = await _context.Products.FirstOrDefaultAsync(p => p.RecipeId == recipe.Id && p.IsActive);
            if (product != null)
            {
                recipe.CreateProductForSale = true;
                recipe.FinalPrice = product.FinalPrice;
            }

            return recipe;
        }

        [HttpPost]
        public async Task<ActionResult<Recipe>> CreateRecipe([FromBody] Recipe recipe)
        {
            recipe.CreatedAt = DateTime.UtcNow;
            _context.Recipes.Add(recipe);
            await _context.SaveChangesAsync();

            await SyncRecipeProduct(recipe);

            return CreatedAtAction(nameof(GetRecipe), new { id = recipe.Id }, recipe);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRecipe(int id, [FromBody] Recipe recipe)
        {
            if (id != recipe.Id) return BadRequest();
            
            var existing = await _context.Recipes
                .Include(r => r.RecipeIngredients)
                .FirstOrDefaultAsync(r => r.Id == id);
                
            if (existing == null) return NotFound();

            // Update main properties
            _context.Entry(existing).CurrentValues.SetValues(recipe);
            _context.Entry(existing).Property(x => x.CreatedAt).IsModified = false;

            // Update Ingredients
            _context.RecipeIngredients.RemoveRange(existing.RecipeIngredients);
            if (recipe.RecipeIngredients != null)
            {
                foreach(var item in recipe.RecipeIngredients)
                {
                    existing.RecipeIngredients.Add(new RecipeIngredient 
                    {
                        IngredientId = item.IngredientId,
                        Quantity = item.Quantity
                    });
                }
            }

            await _context.SaveChangesAsync();

            await SyncRecipeProduct(recipe);

            return NoContent();
        }

        private async Task SyncRecipeProduct(Recipe recipe)
        {
            var existingProduct = await _context.Products.FirstOrDefaultAsync(p => p.RecipeId == recipe.Id);
            
            if (!recipe.CreateProductForSale && existingProduct == null) 
                return;

            decimal totalCost = 0;
            if (recipe.RecipeIngredients != null && recipe.RecipeIngredients.Any())
            {
                var ingredientIds = recipe.RecipeIngredients.Select(ri => ri.IngredientId).ToList();
                var ingredients = await _context.Ingredients.Where(i => ingredientIds.Contains(i.Id)).ToListAsync();
                foreach(var ri in recipe.RecipeIngredients)
                {
                    var ing = ingredients.FirstOrDefault(i => i.Id == ri.IngredientId);
                    if (ing != null)
                    {
                        totalCost += (decimal)ing.CostPrice * ri.Quantity;
                    }
                }
            }

            if (existingProduct != null)
            {
                existingProduct.Name = recipe.Name;
                existingProduct.CostPrice = totalCost;
                if (recipe.CreateProductForSale) 
                {
                    existingProduct.FinalPrice = recipe.FinalPrice;
                    existingProduct.MarginPercentage = totalCost > 0 ? ((recipe.FinalPrice - totalCost) / totalCost) * 100 : 0;
                }
            }
            else if (recipe.CreateProductForSale)
            {
                _context.Products.Add(new Product
                {
                    Name = recipe.Name,
                    Category = "Comida",
                    CostPrice = totalCost,
                    FinalPrice = recipe.FinalPrice,
                    IsActive = true,
                    RecipeId = recipe.Id,
                    CreatedAt = DateTime.UtcNow,
                    Stock = 0,
                    MinimumStock = 0,
                    IvaPercentage = 21,
                    MarginPercentage = totalCost > 0 ? ((recipe.FinalPrice - totalCost) / totalCost) * 100 : 0
                });
            }
            await _context.SaveChangesAsync();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRecipe(int id)
        {
            var recipe = await _context.Recipes.FindAsync(id);
            if (recipe == null) return NotFound();

            recipe.IsActive = false;
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
