import re

with open(r'd:\Antigravity Proyectos\PadelQ\PadelQ.AdminWeb\src\pages\Recipes.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Rename Component
content = content.replace('const ProductsPage = () => {', 'const RecipesPage = () => {')
content = content.replace('export default ProductsPage;', 'export default RecipesPage;')

# 2. Update titles
content = content.replace('Gestión de Productos', 'Gestión de Recetas y Preparados')
content = content.replace('Añadir Producto', 'Añadir Receta')
content = content.replace('Editar Producto', 'Editar Receta')

# 3. Update defaults
content = content.replace("category: 'Bebidas',", "category: 'Comida',")
content = content.replace("isRecipe: false,", "isRecipe: true,")

# 4. Filter fetching
content = content.replace('setProducts(response.data);', 'setProducts(response.data.filter((p: any) => p.isRecipe));')

# 5. Add ingredients fetching and state
state_injection = """  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Product[]>([]);
"""
content = content.replace('  const [products, setProducts] = useState<Product[]>([]);', state_injection)

fetch_injection = """  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products', config);
      setProducts(response.data.filter((p: any) => p.isRecipe));
      setIngredients(response.data.filter((p: any) => !p.isSellable));
    } catch (error) {"""
content = content.replace('''  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products', config);
      setProducts(response.data.filter((p: any) => p.isRecipe));
    } catch (error) {''', fetch_injection)

# 6. Add UI for RecipeItems before the pricing grid
recipe_ui = """
                        {/* INGREDIENTES DE LA RECETA */}
                        <div className="col-span-1 md:col-span-3 lg:col-span-3 mt-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-800 mb-4 border-b pb-2">Ingredientes (Insumos)</h3>
                            <div className="space-y-4">
                                {formData.recipeItems?.map((item, index) => (
                                    <div key={index} className="flex gap-4 items-center bg-zinc-50 p-3 rounded-2xl">
                                        <div className="flex-1">
                                            <select
                                                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-800 focus:ring-2 focus:ring-black"
                                                value={item.baseProductId}
                                                onChange={(e) => {
                                                    const newItems = [...(formData.recipeItems || [])];
                                                    newItems[index].baseProductId = parseInt(e.target.value);
                                                    
                                                    // Auto-calculate cost
                                                    let newCost = 0;
                                                    newItems.forEach(ni => {
                                                        const ing = ingredients.find(i => i.id === ni.baseProductId);
                                                        if (ing) {
                                                            newCost += (ing.costPrice / (ing.purchaseYield || 1)) * ni.quantityToDeduct;
                                                        }
                                                    });
                                                    setFormData({ ...formData, recipeItems: newItems, costPrice: newCost });
                                                }}
                                            >
                                                <option value={0}>Seleccionar Insumo...</option>
                                                {ingredients.map(ing => (
                                                    <option key={ing.id} value={ing.id}>{ing.name} (Costo: {formatARS(ing.costPrice / (ing.purchaseYield || 1))} c/u)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-32">
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="Cantidad"
                                                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-800 focus:ring-2 focus:ring-black"
                                                value={item.quantityToDeduct}
                                                onChange={(e) => {
                                                    const newItems = [...(formData.recipeItems || [])];
                                                    newItems[index].quantityToDeduct = parseInt(e.target.value) || 1;
                                                    
                                                    // Auto-calculate cost
                                                    let newCost = 0;
                                                    newItems.forEach(ni => {
                                                        const ing = ingredients.find(i => i.id === ni.baseProductId);
                                                        if (ing) {
                                                            newCost += (ing.costPrice / (ing.purchaseYield || 1)) * ni.quantityToDeduct;
                                                        }
                                                    });
                                                    setFormData({ ...formData, recipeItems: newItems, costPrice: newCost });
                                                }}
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const newItems = formData.recipeItems?.filter((_, i) => i !== index) || [];
                                                // Auto-calculate cost
                                                let newCost = 0;
                                                newItems.forEach(ni => {
                                                    const ing = ingredients.find(i => i.id === ni.baseProductId);
                                                    if (ing) {
                                                        newCost += (ing.costPrice / (ing.purchaseYield || 1)) * ni.quantityToDeduct;
                                                    }
                                                });
                                                setFormData({ ...formData, recipeItems: newItems, costPrice: newCost });
                                            }}
                                            className="p-3 text-red-500 hover:bg-red-50 rounded-xl"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                                
                                <button 
                                    type="button"
                                    onClick={() => setFormData({ 
                                        ...formData, 
                                        recipeItems: [...(formData.recipeItems || []), { baseProductId: 0, quantityToDeduct: 1 }] 
                                    })}
                                    className="flex items-center gap-2 px-4 py-3 bg-zinc-100 text-zinc-700 font-bold rounded-xl hover:bg-zinc-200 text-sm"
                                >
                                    <Plus className="w-4 h-4" /> Agregar Ingrediente
                                </button>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-3 lg:col-span-3">
"""
content = content.replace('<div className="col-span-1 md:col-span-3 lg:col-span-3">\n                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-zinc-100">', recipe_ui + '\n                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-zinc-100">')

with open(r'd:\Antigravity Proyectos\PadelQ\PadelQ.AdminWeb\src\pages\Recipes.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
