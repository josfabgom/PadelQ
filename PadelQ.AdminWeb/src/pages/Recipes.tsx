import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
    BookOpen, Plus, Edit2, Trash2, ArrowLeft, Search, X, 
    RefreshCcw, AlertCircle, CheckCircle
} from 'lucide-react';
import Header from '../components/Header';

interface Ingredient {
  id: number;
  name: string;
  unitOfMeasure: string;
  stock: number;
  costPrice: number;
}

interface RecipeIngredient {
  ingredientId: number;
  quantity: number;
}

interface Recipe {
  id: number;
  name: string;
  instructions: string;
  isActive: boolean;
  recipeIngredients: RecipeIngredient[];
  createProductForSale?: boolean;
  finalPrice?: number;
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
};

const RecipesPage = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' = 'success', title?: string) => {
      setCustomAlert({
          title: title || (type === 'success' ? 'ÉXITO' : type === 'error' ? 'ERROR' : 'ATENCIÓN'),
          message,
          type
      });
  };

  const [formData, setFormData] = useState<Partial<Recipe>>({
    name: '',
    instructions: '',
    isActive: true,
    recipeIngredients: [],
    createProductForSale: false,
    finalPrice: 0
  });

  const config = getAuthConfig();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recipesRes, ingredientsRes] = await Promise.all([
        api.get('/api/recipes', config),
        api.get('/api/ingredients', config)
      ]);
      setRecipes(recipesRes.data);
      setIngredients(ingredientsRes.data);
    } catch (err) {
      console.error("Error al cargar datos", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRecipeCost = (recipe: Recipe) => {
    if (!recipe.recipeIngredients || recipe.recipeIngredients.length === 0) return 0;
    return recipe.recipeIngredients.reduce((total, item) => {
      const ingredient = ingredients.find(i => i.id === item.ingredientId);
      if (!ingredient) return total;
      return total + (ingredient.costPrice * item.quantity);
    }, 0);
  };

  const handleOpenModal = (recipe?: Recipe) => {
    if (recipe) {
      setEditingRecipe(recipe);
      setFormData({
        id: recipe.id,
        name: recipe.name,
        instructions: recipe.instructions || '',
        isActive: recipe.isActive,
        recipeIngredients: [...recipe.recipeIngredients],
        createProductForSale: false,
        finalPrice: 0
      });
    } else {
      setEditingRecipe(null);
      setFormData({ 
        name: '',
        instructions: '',
        isActive: true,
        recipeIngredients: [],
        createProductForSale: false,
        finalPrice: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleAddIngredient = () => {
    if (ingredients.length === 0) {
      showAlert("No hay insumos disponibles. Crea insumos primero.", "warning");
      return;
    }
    setFormData(prev => ({
      ...prev,
      recipeIngredients: [
        ...(prev.recipeIngredients || []),
        { ingredientId: ingredients[0].id, quantity: 1 }
      ]
    }));
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = [...(formData.recipeIngredients || [])];
    updated.splice(index, 1);
    setFormData(prev => ({ ...prev, recipeIngredients: updated }));
  };

  const handleIngredientChange = (index: number, field: string, value: any) => {
    const updated = [...(formData.recipeIngredients || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, recipeIngredients: updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recipeIngredients || formData.recipeIngredients.length === 0) {
      showAlert("La receta debe tener al menos un insumo.", "warning");
      return;
    }
    try {
      if (editingRecipe) {
        await api.put(`/api/recipes/${editingRecipe.id}`, formData, config);
      } else {
        await api.post('/api/recipes', formData, config);
      }
      setIsModalOpen(false);
      fetchData();
      showAlert("Receta guardada correctamente.", "success");
    } catch (err) {
      console.error("Error al guardar receta", err);
      showAlert("Error al guardar la receta.", "error");
    }
  };

  const executeDeleteRecipe = async () => {
    if (!recipeToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/api/recipes/${recipeToDelete.id}`, config);
      showAlert("Receta eliminada con éxito.");
      setRecipeToDelete(null);
      fetchData();
    } catch (err: any) {
      console.error("Error al eliminar receta", err);
      showAlert("Error al eliminar receta", 'error');
      setRecipeToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 bg-[#FAFAFA] min-h-screen font-outfit">
      <Header />
      
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight uppercase italic">Recetas</h1>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CONTROL DE FORMULACIONES</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:min-w-[400px]">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
             <input 
                type="text" 
                placeholder="Buscar receta por nombre..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-4 bg-white border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm shadow-sm"
             />
          </div>
          <button 
            onClick={() => fetchData()}
            disabled={loading}
            className="p-4 bg-white border border-black/5 rounded-2xl shadow-sm hover:bg-zinc-50 transition-all active:scale-95 disabled:opacity-50"
            title="Refrescar listado"
          >
            <RefreshCcw className={`w-5 h-5 text-black ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-3 px-8 py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nueva Receta
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] border border-black/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-zinc-50/50">
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Receta</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ingredientes</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Costo Estimado</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Venta POS</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-400 font-medium">Cargando recetas...</td></tr>
              ) : filteredRecipes.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-400 font-medium">No se encontraron recetas.</td></tr>
              ) : (
                filteredRecipes.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                          <BookOpen className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-black">{item.name}</p>
                          <p className="text-[10px] text-zinc-400 font-medium truncate max-w-xs">{item.instructions}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-wrap gap-2">
                        {item.recipeIngredients?.map(ri => {
                          const ing = ingredients.find(i => i.id === ri.ingredientId);
                          if (!ing) return null;
                          return (
                            <span key={ri.ingredientId} className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              {ing.name} ({ri.quantity} {ing.unitOfMeasure})
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <span className="text-sm font-black italic text-black tracking-tight">{formatARS(calculateRecipeCost(item))}</span>
                    </td>
                    <td className="p-6 text-right">
                      {item.createProductForSale ? (
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-emerald-500">{formatARS(item.finalPrice || 0)}</span>
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md mt-1">Activo</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No Activo</span>
                      )}
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-xl transition-all"
                          title="Editar Receta"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setRecipeToDelete(item)}
                          className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Eliminar Receta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD Recetas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-black/5 p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-black text-black tracking-tight uppercase italic">
                  {editingRecipe ? 'Editar Receta' : 'Nueva Receta'}
                </h2>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">COMPLETA LOS DATOS DE LA FORMULACIÓN</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nombre de la Receta</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all"
                    placeholder="Ej. Hamburguesa Completa"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Instrucciones / Notas</label>
                  <textarea 
                    value={formData.instructions}
                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all min-h-[100px]"
                    placeholder="Ej. Armar con cuidado..."
                  />
                </div>
              </div>

              {/* Insumos de la Receta */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-black uppercase tracking-widest">Insumos Necesarios</h3>
                  <button 
                    type="button"
                    onClick={handleAddIngredient}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Agregar Insumo
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.recipeIngredients?.map((item, index) => {
                    const selectedIngredient = ingredients.find(i => i.id === item.ingredientId);
                    return (
                      <div key={index} className="flex items-center gap-3 bg-zinc-50 p-3 rounded-2xl border border-black/5">
                        <div className="flex-1">
                          <select
                            value={item.ingredientId}
                            onChange={(e) => handleIngredientChange(index, 'ingredientId', Number(e.target.value))}
                            className="w-full p-3 bg-white border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-black/10 text-sm font-medium"
                          >
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id}>{ing.name} ({ing.unitOfMeasure})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <input 
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => handleIngredientChange(index, 'quantity', Number(e.target.value))}
                            className="w-full p-3 bg-white border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-black/10 text-sm font-medium text-center"
                            placeholder="Cant."
                          />
                        </div>
                        <div className="w-16 text-center">
                          <span className="text-xs font-bold text-zinc-400">{selectedIngredient?.unitOfMeasure}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveIngredient(index)}
                          className="p-3 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  {(!formData.recipeIngredients || formData.recipeIngredients.length === 0) && (
                    <div className="text-center p-6 bg-zinc-50 rounded-2xl border border-black/5 border-dashed">
                      <p className="text-sm font-medium text-zinc-400">No hay insumos agregados.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección de Costo y Venta */}
              <div className="p-6 bg-zinc-50 rounded-[2rem] border border-black/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-black uppercase tracking-widest mb-1">Costo Estimado</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Basado en Insumos</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black italic text-black tracking-tight">{formatARS(calculateRecipeCost(formData as Recipe))}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-black/5 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${formData.createProductForSale ? 'bg-black text-white' : 'bg-white border border-black/10 text-transparent group-hover:border-black/30'}`}>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={formData.createProductForSale || false}
                      onChange={(e) => setFormData({...formData, createProductForSale: e.target.checked})}
                    />
                    <div>
                      <p className="text-sm font-black text-black uppercase tracking-widest">Activar para la Venta</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Crear producto automáticamente en el POS</p>
                    </div>
                  </label>

                  {formData.createProductForSale && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Precio Final de Venta</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-400">$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            required={formData.createProductForSale}
                            value={formData.finalPrice || ''}
                            onChange={(e) => setFormData({...formData, finalPrice: Number(e.target.value)})}
                            className="w-full pl-10 pr-4 py-4 bg-white border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-bold text-lg text-black transition-all"
                            placeholder="Ej. 6500"
                          />
                        </div>
                        {formData.finalPrice! > 0 && (
                          <div className="flex justify-between items-center mt-2 px-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Utilidad Estimada:</span>
                            <span className={`text-xs font-black ${formData.finalPrice! - calculateRecipeCost(formData as Recipe) > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {formatARS(formData.finalPrice! - calculateRecipeCost(formData as Recipe))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-black/5 flex justify-end gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 rounded-2xl text-xs font-black text-zinc-500 hover:bg-zinc-100 transition-colors uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-8 py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all active:scale-95"
                >
                  {editingRecipe ? 'Actualizar Receta' : 'Guardar Receta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {recipeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRecipeToDelete(null)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-black tracking-tight uppercase italic mb-2">Eliminar Receta</h3>
              <p className="text-sm text-zinc-500 font-medium">
                ¿Estás seguro que deseas eliminar la receta <strong className="text-black">{recipeToDelete.name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setRecipeToDelete(null)}
                className="flex-1 py-4 bg-zinc-100 text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={executeDeleteRecipe}
                disabled={isDeleting}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-rose-500/30 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center"
              >
                {isDeleting ? <RefreshCcw className="w-5 h-5 animate-spin" /> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert */}
      {customAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCustomAlert(null)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              customAlert.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
              customAlert.type === 'error' ? 'bg-rose-50 text-rose-500' :
              'bg-amber-50 text-amber-500'
            }`}>
              {customAlert.type === 'success' && <CheckCircle className="w-10 h-10" />}
              {customAlert.type === 'error' && <X className="w-10 h-10" />}
              {customAlert.type === 'warning' && <AlertCircle className="w-10 h-10" />}
            </div>
            <h3 className="text-2xl font-black text-black tracking-tight uppercase italic mb-3">
              {customAlert.title}
            </h3>
            <p className="text-zinc-500 font-medium text-sm leading-relaxed mb-8">
              {customAlert.message}
            </p>
            <button 
              onClick={() => setCustomAlert(null)}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 text-white shadow-xl ${
                customAlert.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' :
                customAlert.type === 'error' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' :
                'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
              }`}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipesPage;
