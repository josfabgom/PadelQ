import re

# 1. Patch ProductsController.cs
file1 = r"d:\Antigravity Proyectos\PadelQ\PadelQ.Api\Controllers\ProductsController.cs"
with open(file1, "r", encoding="utf-8") as f:
    content1 = f.read()

old_post_movement = """        [HttpPost("movement")]
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
        }"""

new_post_movement = """        [HttpPost("movement")]
        public async Task<IActionResult> PostStockMovement([FromBody] ProductStockMovement movement)
        {
            var product = await _context.Products.FindAsync(movement.ProductId);
            if (product == null) return NotFound("Producto no encontrado");

            if (movement.Type == MovementType.Purchase && product.PurchaseYield > 1)
            {
                movement.Quantity = movement.Quantity * product.PurchaseYield;
                movement.Note += $" (Rinde: x{product.PurchaseYield})";
            }

            movement.CreatedAt = DateTime.UtcNow;
            _context.ProductStockMovements.Add(movement);

            // Update product stock
            product.Stock += movement.Quantity;
            
            await _context.SaveChangesAsync();
            return Ok(product);
        }"""

content1 = content1.replace(old_post_movement, new_post_movement)
with open(file1, "w", encoding="utf-8") as f:
    f.write(content1)


# 2. Patch SupplierPurchasesController.cs
file2 = r"d:\Antigravity Proyectos\PadelQ\PadelQ.Api\Controllers\SupplierPurchasesController.cs"
with open(file2, "r", encoding="utf-8") as f:
    content2 = f.read()

old_purchase = """                        // Update stock
                        product.Stock += item.Quantity;
                        
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
                            Quantity = item.Quantity,
                            Note = $"Compra #{purchase.InvoiceNumber ?? purchase.Id.ToString()} - Prov: {purchase.SupplierId}",
                            CreatedAt = DateTime.UtcNow
                        });"""

new_purchase = """                        int finalQuantity = item.Quantity;
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
                        });"""

content2 = content2.replace(old_purchase, new_purchase)

old_delete = """                        // Revert stock
                        product.Stock -= item.Quantity;"""

new_delete = """                        // Revert stock
                        int revertQuantity = item.Quantity;
                        if (product.PurchaseYield > 1)
                        {
                            revertQuantity = item.Quantity * product.PurchaseYield;
                        }
                        product.Stock -= revertQuantity;"""

content2 = content2.replace(old_delete, new_delete)

with open(file2, "w", encoding="utf-8") as f:
    f.write(content2)

print("Controllers patched")
