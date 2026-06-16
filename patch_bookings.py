import re

file_path = r"d:\Antigravity Proyectos\PadelQ\PadelQ.AdminWeb\src\pages\Bookings.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Barcode scanner
content = content.replace(
"""            const product = allProducts.find(p => 
                (p.barcode && p.barcode.trim().toLowerCase() === query) ||
                (p.internalCode && p.internalCode.trim().toLowerCase() === query)
            );""",
"""            const product = allProducts.find(p => 
                p.isSellable !== false && (
                (p.barcode && p.barcode.trim().toLowerCase() === query) ||
                (p.internalCode && p.internalCode.trim().toLowerCase() === query))
            );""")

# 2. Activity Charge Product search
content = content.replace(
"""            setActFilteredProducts(allProducts.filter(p => 
                p.name.toLowerCase().includes(actProductSearch.toLowerCase()) || 
                (p.internalCode && p.internalCode.toLowerCase().includes(actProductSearch.toLowerCase()))
            ).slice(0, 5));""",
"""            setActFilteredProducts(allProducts.filter(p => 
                p.isSellable !== false && (
                p.name.toLowerCase().includes(actProductSearch.toLowerCase()) || 
                (p.internalCode && p.internalCode.toLowerCase().includes(actProductSearch.toLowerCase())))
            ).slice(0, 5));""")

# 3. Direct Sale Product search (Dropdown)
content = content.replace(
"""            setDsFilteredProducts(allProducts.filter(p => 
                p.name.toLowerCase().includes(dsProductSearch.toLowerCase()) || 
                (p.internalCode && p.internalCode.toLowerCase().includes(dsProductSearch.toLowerCase()))
            ).slice(0, 5));""",
"""            setDsFilteredProducts(allProducts.filter(p => 
                p.isSellable !== false && (
                p.name.toLowerCase().includes(dsProductSearch.toLowerCase()) || 
                (p.internalCode && p.internalCode.toLowerCase().includes(dsProductSearch.toLowerCase())))
            ).slice(0, 5));""")

# 4. Booking Consumption product list
content = content.replace(
"""                                    .filter(p =>
                                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                        (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase())) ||
                                        (p.internalCode && p.internalCode.toLowerCase().includes(productSearch.toLowerCase()))
                                    )""",
"""                                    .filter(p => p.isSellable !== false && (
                                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                        (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase())) ||
                                        (p.internalCode && p.internalCode.toLowerCase().includes(productSearch.toLowerCase()))
                                    ))""")

# 5. Direct Sale Grid
content = content.replace(
"""                                        .filter(p =>
                                            p.name.toLowerCase().includes(dsProductSearch.toLowerCase()) ||
                                            (p.barcode && p.barcode.toLowerCase().includes(dsProductSearch.toLowerCase())) ||
                                            (p.internalCode && p.internalCode.toLowerCase().includes(dsProductSearch.toLowerCase())) ||
                                            (p.category && p.category.toLowerCase().includes(dsProductSearch.toLowerCase()))
                                        )""",
"""                                        .filter(p => p.isSellable !== false && (
                                            p.name.toLowerCase().includes(dsProductSearch.toLowerCase()) ||
                                            (p.barcode && p.barcode.toLowerCase().includes(dsProductSearch.toLowerCase())) ||
                                            (p.internalCode && p.internalCode.toLowerCase().includes(dsProductSearch.toLowerCase())) ||
                                            (p.category && p.category.toLowerCase().includes(dsProductSearch.toLowerCase()))
                                        ))""")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Bookings patched")
