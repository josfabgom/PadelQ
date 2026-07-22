import re

with open(r'd:\Antigravity Proyectos\PadelQ\PadelQ.AdminWeb\src\pages\Ingredients.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Rename Component
content = content.replace('const ProductsPage = () => {', 'const IngredientsPage = () => {')
content = content.replace('export default ProductsPage;', 'export default IngredientsPage;')

# 2. Update titles
content = content.replace('Gestión de Productos', 'Gestión de Insumos')
content = content.replace('Añadir Producto', 'Añadir Insumo')
content = content.replace('Editar Producto', 'Editar Insumo')

# 3. Update defaults
content = content.replace("category: 'Bebidas',", "category: 'Insumo',")
content = content.replace("isSellable: true,", "isSellable: false,")

# 4. Filter fetching
content = content.replace('setProducts(response.data);', 'setProducts(response.data.filter((p: any) => !p.isSellable));')

# 5. Remove price fields from form rendering (This is a bit complex via simple replace, but we can remove the block)
# The fields are "Precio Costo", "Margen (%)", "IVA (%)", "Impuesto Int. ($)", "Precio Venta"
# Let's just replace it with a simpler grid that only has Cost
pattern_prices = r'(<div className="grid grid-cols-1 md:grid-cols-3 gap-6">.*?)(<div className="col-span-1 md:col-span-3 lg:col-span-3">)'
match = re.search(pattern_prices, content, re.DOTALL)
if match:
    # Just replace it with a simpler grid that only has Cost
    new_grid = '''<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Precio Costo ($)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <DollarSign className="h-5 w-5 text-zinc-400" />
                                    </div>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all duration-300"
                                        value={formData.costPrice || ''}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            costPrice: parseFloat(e.target.value) || 0
                                        })}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Rinde (Unidades / Porciones)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className="w-full px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all duration-300"
                                        value={formData.purchaseYield || 1}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            purchaseYield: parseInt(e.target.value) || 1
                                        })}
                                        placeholder="Ej: 1"
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-2 italic">Si compras una botella y rinde 10 tragos, pon 10.</p>
                            </div>
                        </div>
                        '''
    content = content[:match.start()] + new_grid + match.group(2) + content[match.end():]

# Remove table column "Precio Venta" and its corresponding td
content = content.replace('<th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Precio Venta</th>', '')
content = content.replace('''<td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-black text-black tabular-nums">{formatARS(product.finalPrice)}</div>
                                        </td>''', '')

with open(r'd:\Antigravity Proyectos\PadelQ\PadelQ.AdminWeb\src\pages\Ingredients.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
