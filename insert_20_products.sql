USE PadelQDB;

-- 10 Beverages
INSERT INTO Products (Name, FinalPrice, CostPrice, Category, IsActive, CreatedAt, Stock, MinimumStock, PurchaseYield, InternalTaxAmount, IvaPercentage, MarginPercentage, IsDoubleUnitCombo)
VALUES 
('Agua Mineral 500ml', 1500, 800, 'Bebidas', 1, GETDATE(), 50, 10, 1, 0, 0, 0, 0),
('Coca Cola 600ml', 2000, 1200, 'Bebidas', 1, GETDATE(), 40, 10, 1, 0, 0, 0, 0),
('Coca Cola Zero 600ml', 2000, 1200, 'Bebidas', 1, GETDATE(), 40, 10, 1, 0, 0, 0, 0),
('Sprite 600ml', 2000, 1200, 'Bebidas', 1, GETDATE(), 30, 10, 1, 0, 0, 0, 0),
('Gatorade Manzana', 2500, 1500, 'Bebidas', 1, GETDATE(), 25, 10, 1, 0, 0, 0, 0),
('Gatorade Naranja', 2500, 1500, 'Bebidas', 1, GETDATE(), 25, 10, 1, 0, 0, 0, 0),
('Cerveza Patagonia 730ml', 4500, 2500, 'Bebidas Alcohólicas', 1, GETDATE(), 20, 5, 1, 0, 0, 0, 0),
('Cerveza Stella Artois 710ml', 4500, 2600, 'Bebidas Alcohólicas', 1, GETDATE(), 20, 5, 1, 0, 0, 0, 0),
('Agua Saborizada Levite Manzana', 1800, 1000, 'Bebidas', 1, GETDATE(), 30, 10, 1, 0, 0, 0, 0),
('Agua Saborizada Levite Pera', 1800, 1000, 'Bebidas', 1, GETDATE(), 30, 10, 1, 0, 0, 0, 0);

-- 5 Ingredients (Insumos)
INSERT INTO Products (Name, FinalPrice, CostPrice, Category, IsActive, CreatedAt, Stock, MinimumStock, PurchaseYield, InternalTaxAmount, IvaPercentage, MarginPercentage, IsDoubleUnitCombo)
VALUES 
('Pan de Hamburguesa (Unidad)', 0, 300, 'Insumos', 1, GETDATE(), 100, 20, 1, 0, 0, 0, 0),
('Medallón de Carne (Unidad)', 0, 800, 'Insumos', 1, GETDATE(), 100, 20, 1, 0, 0, 0, 0),
('Queso Cheddar (Feta)', 0, 150, 'Insumos', 1, GETDATE(), 200, 50, 1, 0, 0, 0, 0),
('Pancho (Salchicha)', 0, 400, 'Insumos', 1, GETDATE(), 100, 20, 1, 0, 0, 0, 0),
('Pan de Pancho (Unidad)', 0, 250, 'Insumos', 1, GETDATE(), 100, 20, 1, 0, 0, 0, 0);

-- Get IDs of ingredients
DECLARE @PanHamburguesaId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Pan de Hamburguesa (Unidad)' ORDER BY Id DESC);
DECLARE @MedallonCarneId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Medallón de Carne (Unidad)' ORDER BY Id DESC);
DECLARE @QuesoCheddarId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Queso Cheddar (Feta)' ORDER BY Id DESC);
DECLARE @SalchichaId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Pancho (Salchicha)' ORDER BY Id DESC);
DECLARE @PanPanchoId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Pan de Pancho (Unidad)' ORDER BY Id DESC);

-- 5 Recipes
INSERT INTO Products (Name, FinalPrice, CostPrice, Category, IsActive, CreatedAt, Stock, MinimumStock, PurchaseYield, InternalTaxAmount, IvaPercentage, MarginPercentage, IsDoubleUnitCombo)
VALUES 
('Hamburguesa Simple', 6000, 1250, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0),
('Hamburguesa Completa (Doble Carne)', 8000, 2050, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0),
('Pancho Simple', 3000, 650, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0),
('Pancho con Cheddar', 3500, 800, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0),
('Hamburguesa con Cheddar', 6500, 1400, 'Comida', 1, GETDATE(), 0, 0, 1, 0, 0, 0, 0);

DECLARE @HamburguesaSimpleId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Hamburguesa Simple' ORDER BY Id DESC);
DECLARE @HamburguesaCompletaId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Hamburguesa Completa (Doble Carne)' ORDER BY Id DESC);
DECLARE @PanchoSimpleId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Pancho Simple' ORDER BY Id DESC);
DECLARE @PanchoCheddarId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Pancho con Cheddar' ORDER BY Id DESC);
DECLARE @HamburguesaCheddarId INT = (SELECT TOP 1 Id FROM Products WHERE Name = 'Hamburguesa con Cheddar' ORDER BY Id DESC);

-- Insert Recipe Items
INSERT INTO ProductRecipeItems (RecipeProductId, BaseProductId, QuantityToDeduct)
VALUES
(@HamburguesaSimpleId, @PanHamburguesaId, 1),
(@HamburguesaSimpleId, @MedallonCarneId, 1),

(@HamburguesaCompletaId, @PanHamburguesaId, 1),
(@HamburguesaCompletaId, @MedallonCarneId, 2),
(@HamburguesaCompletaId, @QuesoCheddarId, 1),

(@PanchoSimpleId, @PanPanchoId, 1),
(@PanchoSimpleId, @SalchichaId, 1),

(@PanchoCheddarId, @PanPanchoId, 1),
(@PanchoCheddarId, @SalchichaId, 1),
(@PanchoCheddarId, @QuesoCheddarId, 1),

(@HamburguesaCheddarId, @PanHamburguesaId, 1),
(@HamburguesaCheddarId, @MedallonCarneId, 1),
(@HamburguesaCheddarId, @QuesoCheddarId, 2);
