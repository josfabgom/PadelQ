import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
    Package, Plus, Edit2, Trash2, ArrowLeft, Search, X, 
    RefreshCcw, AlertCircle, CheckCircle
} from 'lucide-react';
import Header from '../components/Header';

interface Ingredient {
  id: number;
  name: string;
  unitOfMeasure: string;
  stock: number;
  minimumStock: number;
  costPrice: number;
  category: string;
  isActive: boolean;
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
};

const IngredientsPage = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' = 'success', title?: string) => {
      setCustomAlert({
          title: title || (type === 'success' ? 'ÉXITO' : type === 'error' ? 'ERROR' : 'ATENCIÓN'),
          message,
          type
      });
  };

  const [formData, setFormData] = useState<Partial<Ingredient>>({
    name: '',
    unitOfMeasure: 'uds',
    stock: 0,
    minimumStock: 0,
    costPrice: 0,
    category: 'Insumo',
    isActive: true
  });

  const config = getAuthConfig();

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/ingredients', config);
      setIngredients(response.data);
    } catch (err) {
      console.error("Error al cargar insumos", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (ingredient?: Ingredient) => {
    if (ingredient) {
      setEditingIngredient(ingredient);
      setFormData(ingredient);
    } else {
      setEditingIngredient(null);
      setFormData({ 
        name: '',
        unitOfMeasure: 'uds',
        stock: 0,
        minimumStock: 0,
        costPrice: 0,
        category: 'Insumo',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingIngredient) {
        await api.put(`/api/ingredients/${editingIngredient.id}`, formData, config);
      } else {
        await api.post('/api/ingredients', formData, config);
      }
      setIsModalOpen(false);
      fetchIngredients();
      showAlert("Insumo guardado correctamente.", "success");
    } catch (err) {
      console.error("Error al guardar insumo", err);
      showAlert("Error al guardar el insumo.", "error");
    }
  };

  const executeDeleteIngredient = async () => {
    if (!ingredientToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/api/ingredients/${ingredientToDelete.id}`, config);
      showAlert("Insumo eliminado con éxito.");
      setIngredientToDelete(null);
      fetchIngredients();
    } catch (err: any) {
      console.error("Error al eliminar insumo", err);
      showAlert("Error al eliminar insumo", 'error');
      setIngredientToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const categories = ['Todas', ...Array.from(new Set(ingredients.map(i => i.category)))];

  const filteredIngredients = ingredients.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || i.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
            <h1 className="text-3xl font-black text-black tracking-tight uppercase italic">Insumos</h1>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CONTROL INTEGRAL DE INSUMOS</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:min-w-[400px]">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
             <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-4 bg-white border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm shadow-sm"
             />
          </div>
          <button 
            onClick={() => fetchIngredients()}
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
            Nuevo Insumo
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
              selectedCategory === cat 
              ? 'bg-black text-white border-black shadow-md' 
              : 'bg-white text-zinc-400 border-zinc-100 hover:border-black/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] border border-black/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-zinc-50/50">
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Insumo</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Categoría</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Stock Actual</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Costo</th>
                <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-400 font-medium">Cargando insumos...</td></tr>
              ) : filteredIngredients.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-400 font-medium">No se encontraron insumos.</td></tr>
              ) : (
                filteredIngredients.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                          <Package className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-black">{item.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-black tracking-tight ${item.stock <= item.minimumStock ? 'text-rose-600' : 'text-black'}`}>
                            {item.stock} {item.unitOfMeasure}
                          </span>
                          {item.stock <= item.minimumStock && (
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mínimo: {item.minimumStock}</span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <span className="text-sm font-black italic text-black tracking-tight">{formatARS(item.costPrice)}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-xl transition-all"
                          title="Editar Insumo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setIngredientToDelete(item)}
                          className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Eliminar Insumo"
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

      {/* Modal CRUD Insumos */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-black/5 p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-black text-black tracking-tight uppercase italic">
                  {editingIngredient ? 'Editar Insumo' : 'Nuevo Insumo'}
                </h2>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">COMPLETA LOS DATOS DEL INSUMO</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nombre del Insumo</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all"
                    placeholder="Ej. Pan de Hamburguesa"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Categoría</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all"
                    placeholder="Ej. Insumos"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Unidad de Medida</label>
                  <select
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({...formData, unitOfMeasure: e.target.value})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all appearance-none"
                  >
                    <option value="uds">Unidades (uds)</option>
                    <option value="gr">Gramos (gr)</option>
                    <option value="ml">Mililitros (ml)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Stock Actual</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required 
                    value={formData.stock === 0 ? '' : formData.stock}
                    onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all"
                    placeholder="Ej. 100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Stock Mínimo</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required 
                    value={formData.minimumStock === 0 ? '' : formData.minimumStock}
                    onChange={(e) => setFormData({...formData, minimumStock: Number(e.target.value)})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all"
                    placeholder="Ej. 10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Costo</label>
                  <input 
                    type="number"
                    step="0.01" 
                    required 
                    value={formData.costPrice === 0 ? '' : formData.costPrice}
                    onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})}
                    className="w-full p-4 bg-zinc-50 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm transition-all"
                    placeholder="Ej. 1500"
                  />
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
                  {editingIngredient ? 'Actualizar Insumo' : 'Crear Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {ingredientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIngredientToDelete(null)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-black tracking-tight uppercase italic mb-2">Eliminar Insumo</h3>
              <p className="text-sm text-zinc-500 font-medium">
                ¿Estás seguro que deseas eliminar el insumo <strong className="text-black">{ingredientToDelete.name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIngredientToDelete(null)}
                className="flex-1 py-4 bg-zinc-100 text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={executeDeleteIngredient}
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

export default IngredientsPage;
