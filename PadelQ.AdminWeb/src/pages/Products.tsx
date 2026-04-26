import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
    Package, Plus, Edit2, Trash2, DollarSign, ArrowLeft, Tag, Search, X, 
    TrendingUp, TrendingDown, RefreshCcw, Camera, AlertCircle, ShoppingCart, Info,
    ChevronRight, ChevronDown, Filter, History
} from 'lucide-react';
import Header from '../components/Header';
import { format } from 'date-fns';

interface Product {
  id: number;
  internalCode?: string;
  barcode?: string;
  name: string;
  description?: string;
  finalPrice: number;
  costPrice: number;
  stock: number;
  imageUrl?: string;
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

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]');
  const isAdmin = roles.includes('Admin');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState<Partial<Product>>({
    internalCode: '',
    barcode: '',
    name: '',
    description: '',
    finalPrice: 0,
    costPrice: 0,
    stock: 0,
    imageUrl: '',
    category: 'Bebidas',
    isActive: true
  });

  const [stockFormData, setStockFormData] = useState({
    type: 0, // 0: Purchase, 1: Adjustment
    quantity: 1,
    note: ''
  });

  const config = getAuthConfig();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/products', config);
      setProducts(response.data);
    } catch (err) {
      console.error("Error al cargar productos", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ 
        internalCode: '', 
        barcode: '', 
        name: '', 
        description: '', 
        finalPrice: 0, 
        costPrice: 0,
        stock: 0,
        imageUrl: '',
        category: 'Bebidas', 
        isActive: true 
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenStockModal = (product: Product) => {
    setStockProduct(product);
    setStockFormData({ type: 0, quantity: 1, note: '' });
    setIsStockModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/api/products/${editingProduct.id}`, formData, config);
      } else {
        await api.post('/api/products', formData, config);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error("Error al guardar producto", err);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;

    try {
      await api.post('/api/products/movement', {
        productId: stockProduct.id,
        type: stockFormData.type,
        quantity: stockFormData.quantity,
        note: stockFormData.note
      }, config);
      
      setIsStockModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error("Error al registrar movimiento", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este producto?')) {
      try {
        await api.delete(`/api/products/${id}`, config);
        fetchProducts();
      } catch (err) {
        console.error("Error al eliminar producto", err);
      }
    }
  };

  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.barcode?.includes(searchQuery) ||
                         p.internalCode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
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
            <h1 className="text-3xl font-black text-black tracking-tight uppercase italic">Catálogo y Stock</h1>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CONTROL INTEGRAL DE PRODUCTOS E INVENTARIO</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:min-w-[400px]">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
             <input 
                type="text" 
                placeholder="Buscar por nombre, código o código de barras..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-4 bg-white border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm shadow-sm"
             />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-3 px-8 py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nuevo Producto
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

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 gap-4 bg-white rounded-[40px] border border-black/5">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-100 border-t-black"></div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sincronizando inventario...</p>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Producto</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Códigos</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Stock</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Precio Costo</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Precio Venta</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Rentabilidad</th>
                  <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredProducts.map((product) => {
                  const profit = product.finalPrice - product.costPrice;
                  const profitMargin = product.costPrice > 0 ? (profit / product.costPrice) * 100 : 0;
                  
                  return (
                    <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-zinc-300" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-black italic leading-tight">{product.name}</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500">
                            <Tag className="w-3 h-3" /> {product.internalCode || 'S/C'}
                          </div>
                          <div className="text-[9px] font-medium text-zinc-400 font-mono">
                            {product.barcode || 'Sin CB'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`px-4 py-1.5 rounded-xl text-xs font-black italic flex items-center gap-2 ${
                            product.stock <= 5 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {product.stock} <span className="text-[9px] opacity-60">uds</span>
                          </div>
                          {product.stock <= 5 && (
                            <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> Stock Bajo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-zinc-500">{formatARS(product.costPrice)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-base font-black italic text-black tracking-tight">{formatARS(product.finalPrice)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                           <span className={`text-[10px] font-black ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {profit >= 0 ? '+' : ''}{formatARS(profit)}
                           </span>
                           <span className="text-[9px] font-bold text-zinc-400">
                             {profitMargin.toFixed(0)}% margen
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenStockModal(product)}
                            className="p-3 bg-zinc-100 hover:bg-black hover:text-white rounded-xl transition-all text-zinc-500"
                            title="Gestionar Stock"
                          >
                            <RefreshCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(product)}
                            className="p-3 bg-zinc-100 hover:bg-black hover:text-white rounded-xl transition-all text-zinc-500"
                            title="Editar Datos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDelete(product.id)}
                              className="p-3 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all text-rose-400"
                              title="Dar de Baja"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="py-24 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Package className="w-10 h-10 text-zinc-200" />
                </div>
                <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-xs italic">No se encontraron productos en el inventario</p>
                <button onClick={() => setSearchQuery('')} className="mt-4 text-black font-black uppercase text-[10px] tracking-widest border-b-2 border-black">Limpiar búsqueda</button>
            </div>
          )}
        </div>
      )}

      {/* Main Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-300 border border-black/5">
            <div className="p-10 bg-gradient-to-br from-zinc-800 to-black text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
              <button onClick={() => setIsModalOpen(false)} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors z-10">
                <X className="w-5 h-5" />
              </button>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-black italic uppercase tracking-tight leading-none mb-2">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">FICHA TÉCNICA Y PRECIOS</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Información Principal</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm"
                      placeholder="Nombre del Producto (ej: Coca Cola)"
                      required
                    />
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm min-h-[100px] resize-none"
                      placeholder="Descripción detallada..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Imagen del Producto (URL)</label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm"
                          placeholder="https://link-a-la-imagen.jpg"
                        />
                      </div>
                      <div className="w-14 h-14 rounded-2xl bg-zinc-50 border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                        {formData.imageUrl ? (
                          <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-5 h-5 text-zinc-300" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logistics & Pricing */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cód. Interno</label>
                      <input 
                        type="text" 
                        value={formData.internalCode}
                        onChange={(e) => setFormData({...formData, internalCode: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                        placeholder="BEB-01"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Barras</label>
                      <input 
                        type="text" 
                        value={formData.barcode}
                        onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                        placeholder="779..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Categoría</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-black text-sm italic appearance-none"
                    >
                      <option value="Bebidas">Bebidas</option>
                      <option value="Comida">Comida</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Indumentaria">Indumentaria</option>
                      <option value="Pelotas/Padel">Pelotas/Padel</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Costo</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-3 h-3" />
                        <input 
                          type="number" 
                          value={formData.costPrice}
                          onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})}
                          className="w-full pl-10 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-black text-base italic"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Precio Venta</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4" />
                        <input 
                          type="number" 
                          value={formData.finalPrice}
                          onChange={(e) => setFormData({...formData, finalPrice: Number(e.target.value)})}
                          className="w-full pl-10 pr-4 py-4 bg-emerald-50 border border-emerald-100 rounded-2xl outline-none font-black text-xl italic text-emerald-600"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${formData.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Estado Activo</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                      className={`w-12 h-6 rounded-full relative transition-all ${formData.isActive ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isActive ? 'right-1' : 'left-1'}`}></div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-10">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-5 bg-zinc-100 text-zinc-400 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-5 bg-black text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-black/30 hover:bg-zinc-800 transition-all active:scale-95"
                >
                  {editingProduct ? 'Actualizar Ficha Técnica' : 'Registrar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {isStockModalOpen && stockProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 bg-zinc-900 text-white relative">
              <button onClick={() => setIsStockModalOpen(false)} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <RefreshCcw className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-tight">Gestión de Stock</h2>
                  <p className="text-emerald-400/60 text-[9px] font-black uppercase tracking-widest">Movimiento de Inventario</p>
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Producto</p>
                <p className="font-black italic text-sm">{stockProduct.name}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Stock Actual</span>
                  <span className="text-lg font-black italic text-emerald-400">{stockProduct.stock} uds</span>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleStockSubmit} className="p-8 space-y-6">
              <div className="flex bg-zinc-100 p-1.5 rounded-2xl">
                <button 
                  type="button"
                  onClick={() => setStockFormData({...stockFormData, type: 0})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${stockFormData.type === 0 ? 'bg-white text-emerald-600 shadow-md' : 'text-zinc-400'}`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Compra
                </button>
                <button 
                  type="button"
                  onClick={() => setStockFormData({...stockFormData, type: 1})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${stockFormData.type === 1 ? 'bg-white text-amber-600 shadow-md' : 'text-zinc-400'}`}
                >
                  <Info className="w-3.5 h-3.5" /> Ajuste
                </button>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Cantidad a {stockFormData.type === 0 ? 'Ingresar' : 'Ajustar'}</label>
                <div className="flex items-center gap-6">
                  <button 
                    type="button"
                    onClick={() => setStockFormData({...stockFormData, quantity: stockFormData.quantity - 1})}
                    className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center font-black text-xl hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    value={stockFormData.quantity}
                    onChange={(e) => setStockFormData({...stockFormData, quantity: Number(e.target.value)})}
                    className="flex-1 h-14 bg-zinc-50 border border-zinc-100 rounded-2xl text-center font-black text-2xl outline-none"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setStockFormData({...stockFormData, quantity: stockFormData.quantity + 1})}
                    className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center font-black text-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                  >
                    +
                  </button>
                </div>
                <p className="text-[9px] font-bold text-zinc-400 italic text-center">
                  {stockFormData.type === 0 
                    ? "Registra un ingreso por compra (suma al stock)" 
                    : "Ajuste manual (puedes usar números negativos para restar)"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Nota / Motivo</label>
                <input 
                  type="text" 
                  value={stockFormData.note}
                  onChange={(e) => setStockFormData({...stockFormData, note: e.target.value})}
                  className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                  placeholder="Ej: Compra a Proveedor X"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-black/20 hover:bg-zinc-800 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                Confirmar Movimiento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
