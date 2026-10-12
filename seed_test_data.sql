USE PadelQDB;

-- 1. Insert Beverages (Products)
INSERT INTO Products (Name, FinalPrice, CostPrice, Category, IsActive, CreatedAt, Stock, MinimumStock, PurchaseYield, InternalTaxAmount, IvaPercentage, MarginPercentage, IsDoubleUnitCombo)
VALUES 
('Agua Mineral 500ml', 1500, 800, 'Bebidas', 1, GETDATE(), 50, 10, 1, 0, 0, 0, 0),
('Coca Cola 600ml', 2000, 1200, 'Bebidas', 1, GETDATE(), 40, 10, 1, 0, 0, 0, 0),
('Coca Cola Zero 600ml', 2000, 1200, 'Bebidas', 1, GETDATE(), 40, 10, 1, 0, 0, 0, 0),
('Sprite 600ml', 2000, 1200, 'Bebidas', 1, GETDATE(), 30, 10, 1, 0, 0, 0, 0),
('Gatorade Manzana', 2500, 1500, 'Bebidas', 1, GETDATE(), 25, 10, 1, 0, 0, 0, 0),
('Gatorade Naranja', 2500, 1500, 'Bebidas', 1, GETDATE(), 25, 10, 1, 0, 0, 0, 0),
('Cerveza Patagonia 730ml', 4500, 2500, 'Bebidas Alcohólicas', 1, GETDATE(), 20, 5, 1, 0, 0, 0, 0),
('Cerveza Stella Artois 710ml', 4500, 2600, 'Bebidas Alcohólicas', 1, GETDATE(), 20, 5, 1, 0, 0, 0, 0);

-- 2. Insert Ingredients
INSERT INTO Ingredients (Name, UnitOfMeasure, Stock, MinimumStock, CostPrice, IsActive, Category, CreatedAt)
VALUES 
('Pan de Hamburguesa', 'uds', 100, 20, 300, 1, 'Insumos', GETDATE()),
('Medallón de Carne', 'uds', 100, 20, 800, 1, 'Insumos', GETDATE()),
('Queso Cheddar', 'fetas', 200, 50, 150, 1, 'Insumos', GETDATE()),
('Salchicha', 'uds', 100, 20, 400, 1, 'Insumos', GETDATE()),
('Pan de Pancho', 'uds', 100, 20, 250, 1, 'Insumos', GETDATE());

-- Get Ingredient IDs
DECLARE @PanHamburguesaId INT = (SELECT TOP 1 Id FROM Ingredients WHERE Name = 'Pan de Hamburguesa' ORDER BY Id DESC);
DECLARE @MedallonCarneId INT = (SELECT TOP 1 Id FROM Ingredients WHERE Name = 'Medallón de Carne' ORDER BY Id DESC);
DECLARE @QuesoCheddarId INT = (SELECT TOP 1 Id FROM Ingredients WHERE Name = 'Queso Cheddar' ORDER BY Id DESC);
DECLARE @SalchichaId INT = (SELECT TOP 1 Id FROM Ingredients WHERE Name = 'Salchicha' ORDER BY Id DESC);
DECLARE @PanPanchoId INT = (SELECT TOP 1 Id FROM Ingredients WHERE Name = 'Pan de Pancho' ORDER BY Id DESC);

-- 3. Insert Recipes
INSERT INTO Recipes (Name, Instructions, IsActive, CreatedAt)
VALUES 
('Receta Hamburguesa Simple', 'Cocinar medallón, armar con pan.', 1, GETDATE()),
('Receta Hamburguesa Doble', 'Cocinar 2 medallones, armar con pan y cheddar.', 1, GETDATE()),
('Receta Pancho Simple', 'Hervir salchicha, servir en pan.', 1, GETDATE());

-- Get Recipe IDs
DECLARE @RecetaHamSimple INT = (SELECT TOP 1 Id FROM Recipes WHERE Name = 'Receta Hamburguesa Simple' ORDER BY Id DESC);
DECLARE @RecetaHamDoble INT = (SELECT TOP 1 Id FROM Recipes WHERE Name = 'Receta Hamburguesa Doble' ORDER BY Id DESC);
DECLARE @RecetaPancho INT = (SELECT TOP 1 Id FROM Recipes WHERE Name = 'Receta Pancho Simple' ORDER BY Id DESC);

-- 4. Map Recipe Ingredients
INSERT INTO RecipeIngredients (RecipeId, IngredientId, Quantity)
VALUES 
(@RecetaHamSimple, @PanHamburguesaId, 1),
(@RecetaHamSimple, @MedallonCarneId, 1),

(@RecetaHamDoble, @PanHamburguesaId, 1),
(@RecetaHamDoble, @MedallonCarneId, 2),
(@RecetaHamDoble, @QuesoCheddarId, 1),

(@RecetaPancho, @PanPanchoId, 1),
(@RecetaPancho, @SalchichaId, 1);

-- 5. Insert Sellable Products linked to Recipes
INSERT INTO Products (Name, FinalPrice, CostPrice, Category, IsActive, CreatedAt, Stock, MinimumStock, PurchaseYield, InternalTaxAmount, IvaPercentage, MarginPercentage, IsDoubleUnitCombo, RecipeId)
VALUES 
('Hamburguesa Simple', 6000, 1100, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0, @RecetaHamSimple),
('Hamburguesa Doble', 8000, 2050, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0, @RecetaHamDoble),
('Pancho Simple', 3000, 650, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0, @RecetaPancho);
