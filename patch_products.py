import re

file_path = r"d:\Antigravity Proyectos\PadelQ\PadelQ.Api\Controllers\ProductsController.cs"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Update GetProducts
get_prod_old = """        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            return await _context.Products
                .Where(p => p.IsActive)
                .OrderBy(p => p.Category)
                .ThenBy(p => p.Name)
                .ToListAsync();
        }"""
get_prod_new = """        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            return await _context.Products
                .Include(p => p.RecipeItems)
                .Where(p => p.IsActive)
                .OrderBy(p => p.Category)
                .ThenBy(p => p.Name)
                .ToListAsync();
        }"""
content = content.replace(get_prod_old, get_prod_new)

# Update GetProduct
get_prod_id_old = """        public async Task<ActionResult<Product>> GetProduct(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound();
            return product;
        }"""
get_prod_id_new = """        public async Task<ActionResult<Product>> GetProduct(int id)
        {
            var product = await _context.Products
                .Include(p => p.RecipeItems)
                .FirstOrDefaultAsync(p => p.Id == id);
            if (product == null) return NotFound();
            return product;
        }"""
content = content.replace(get_prod_id_old, get_prod_id_new)

# Update UpdateProduct
update_old = """        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] Product product)
        {
            if (id != product.Id) return BadRequest();
            _context.Entry(product).State = EntityState.Modified;
            _context.Entry(product).Property(x => x.CreatedAt).IsModified = false;
            await _context.SaveChangesAsync();
            return NoContent();
        }"""
update_new = """        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] Product product)
        {
            if (id != product.Id) return BadRequest();
            
            var existingProduct = await _context.Products
                .Include(p => p.RecipeItems)
                .FirstOrDefaultAsync(p => p.Id == id);
                
            if (existingProduct == null) return NotFound();

            // Update main properties
            _context.Entry(existingProduct).CurrentValues.SetValues(product);
            _context.Entry(existingProduct).Property(x => x.CreatedAt).IsModified = false;

            // Update RecipeItems
            existingProduct.RecipeItems.Clear();
            if (product.IsRecipe && product.RecipeItems != null)
            {
                foreach(var item in product.RecipeItems)
                {
                    existingProduct.RecipeItems.Add(new ProductRecipeItem 
                    {
                        BaseProductId = item.BaseProductId,
                        QuantityToDeduct = item.QuantityToDeduct
                    });
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }"""
content = content.replace(update_old, update_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("ProductsController patched")
