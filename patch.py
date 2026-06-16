import re

file_path = r"d:\Antigravity Proyectos\PadelQ\PadelQ.Api\Controllers\ConsumptionsController.cs"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add ApplyStockDeductionAsync to the class
helper_method = """
        private async Task ApplyStockDeductionAsync(Product product, int quantity, string note)
        {
            if (product.IsRecipe)
            {
                var recipeItems = await _context.ProductRecipeItems.Where(r => r.RecipeProductId == product.Id).ToListAsync();
                foreach (var item in recipeItems)
                {
                    var baseProduct = await _context.Products.FindAsync(item.BaseProductId);
                    if (baseProduct != null)
                    {
                        int deductQuantity = quantity * item.QuantityToDeduct;
                        baseProduct.Stock -= deductQuantity;
                        _context.ProductStockMovements.Add(new ProductStockMovement
                        {
                            ProductId = baseProduct.Id,
                            Type = quantity >= 0 ? MovementType.Sale : MovementType.Adjustment,
                            Quantity = -deductQuantity,
                            Note = $"{note} (Receta: {product.Name})"
                        });
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
"""
# Find the end of the class (before the DTO classes)
class_end_idx = content.rfind("    public class AddConsumptionRequest")
content = content[:class_end_idx] + helper_method + "\n" + content[class_end_idx:]

# 2. Update AddConsumption
add_cons_old = """            // Stock Control
            product.Stock -= request.Quantity;
            _context.ProductStockMovements.Add(new ProductStockMovement
            {
                ProductId = product.Id,
                Type = MovementType.Sale,
                Quantity = -request.Quantity,
                Note = $"Venta en {(isNormalBooking ? "Reserva" : "Espacio")} {request.BookingId}"
            });"""
add_cons_new = """            // Stock Control
            await ApplyStockDeductionAsync(product, request.Quantity, $"Venta en {(isNormalBooking ? "Reserva" : "Espacio")} {request.BookingId}");"""
content = content.replace(add_cons_old, add_cons_new)

# 3. Update DeleteConsumption
delete_old = """            var product = await _context.Products.FindAsync(consumption.ProductId);
            if (product != null)
            {
                product.Stock += consumption.Quantity;
                _context.ProductStockMovements.Add(new ProductStockMovement
                {
                    ProductId = product.Id,
                    Type = MovementType.Adjustment,
                    Quantity = consumption.Quantity,
                    Note = $"Devolución/Borrado en Reserva {consumption.BookingId}"
                });
            }"""
delete_new = """            var product = await _context.Products.FindAsync(consumption.ProductId);
            if (product != null)
            {
                await ApplyStockDeductionAsync(product, -consumption.Quantity, $"Devolución/Borrado en Reserva {consumption.BookingId}");
                if (product.IsDoubleUnitCombo && consumption.IsComboRedeemed)
                {
                    await ApplyStockDeductionAsync(product, -consumption.Quantity, $"Devolución de 2da Unidad Combo {consumption.BookingId}");
                }
            }"""
content = content.replace(delete_old, delete_new)

# 4. Update BulkDirectSale
bulk_old = """                // Stock Control
                product.Stock -= item.Quantity;
                _context.ProductStockMovements.Add(new ProductStockMovement
                {
                    ProductId = product.Id,
                    Type = MovementType.Sale,
                    Quantity = -item.Quantity,
                    Note = request.IsInternal ? $"Consumo Interno: {product.Name}" : (request.IsPaid ? $"Venta Directa Bulk: {product.Name} (Pagado){discountAppliedStr}" : $"Venta Directa Bulk: {product.Name} (PENDIENTE){discountAppliedStr}")
                });"""
bulk_new = """                // Stock Control
                string note = request.IsInternal ? $"Consumo Interno: {product.Name}" : (request.IsPaid ? $"Venta Directa Bulk: {product.Name} (Pagado){discountAppliedStr}" : $"Venta Directa Bulk: {product.Name} (PENDIENTE){discountAppliedStr}");
                await ApplyStockDeductionAsync(product, item.Quantity, note);"""
content = content.replace(bulk_old, bulk_new)

# 5. Update DirectSale
ds_old = """            // Stock Control
            product.Stock -= request.Quantity;
            _context.ProductStockMovements.Add(new ProductStockMovement
            {
                ProductId = product.Id,
                Type = MovementType.Sale,
                Quantity = -request.Quantity,
                Note = request.IsInternal ? $"Consumo Interno: {product.Name}" : (request.IsPaid ? $"Venta Directa: {product.Name} (Pagado){discountAppliedStr}" : $"Venta Directa: {product.Name} (PENDIENTE){discountAppliedStr}")
            });"""
ds_new = """            // Stock Control
            string note = request.IsInternal ? $"Consumo Interno: {product.Name}" : (request.IsPaid ? $"Venta Directa: {product.Name} (Pagado){discountAppliedStr}" : $"Venta Directa: {product.Name} (PENDIENTE){discountAppliedStr}");
            await ApplyStockDeductionAsync(product, request.Quantity, note);"""
content = content.replace(ds_old, ds_new)

# 6. Update ToggleComboRedeem
toggle_old = """            consumption.IsComboRedeemed = !consumption.IsComboRedeemed;
            await _context.SaveChangesAsync();"""
toggle_new = """            consumption.IsComboRedeemed = !consumption.IsComboRedeemed;
            
            int modifier = consumption.IsComboRedeemed ? 1 : -1;
            string note = modifier > 0 ? $"Canje de 2da Unidad Combo {consumption.BookingId}" : $"Deshacer canje Combo {consumption.BookingId}";
            await ApplyStockDeductionAsync(consumption.Product, consumption.Quantity * modifier, note);
            
            await _context.SaveChangesAsync();"""
content = content.replace(toggle_old, toggle_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied")
