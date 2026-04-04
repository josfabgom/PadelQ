import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import Header from '../components/Header';
import { 
  CreditCard, Plus, Edit2, Trash2, ArrowLeft, 
  Check, X, Palette, Type, ShieldCheck, Zap
} from 'lucide-react';

interface PaymentMethod {
  id: number;
  name: string;
  isActive: boolean;
  iconName?: string;
  hexColor?: string;
}

const PaymentMethods = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]');
  const isAdmin = roles.includes('Admin');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    isActive: true,
    hexColor: '#000000',
    iconName: 'CreditCard'
  });

  const fetchMethods = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/PaymentMethods', getAuthConfig());
      setMethods(res.data);
    } catch (err) {
      console.error("Error fetching payment methods", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleOpenModal = (method?: PaymentMethod) => {
    setError(null);
    if (method) {
      setEditingMethod(method);
      setFormData({
        name: method.name,
        isActive: method.isActive,
        hexColor: method.hexColor || '#000000',
        iconName: method.iconName || 'CreditCard'
      });
    } else {
      setEditingMethod(null);
      setFormData({
        name: '',
        isActive: true,
        hexColor: '#000000',
        iconName: 'CreditCard'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingMethod) {
        await api.put(`/api/PaymentMethods/${editingMethod.id}`, { id: editingMethod.id, ...formData }, getAuthConfig());
      } else {
        await api.post('/api/PaymentMethods', formData, getAuthConfig());
      }
      setIsModalOpen(false);
      fetchMethods();
    } catch (err: any) {
      console.error("Error saving payment method", err);
      setError(err.response?.data || "Error al guardar el medio de pago.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Desea eliminar o desactivar este medio de pago?')) {
      try {
        await api.delete(`/api/PaymentMethods/${id}`, getAuthConfig());
        fetchMethods();
      } catch (err) {
        console.error("Error deleting payment method", err);
      }
    }
  };

  return (
    <div className="p-10 space-y-10 bg-[#fafafa] min-h-screen font-oak">
      <Header />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300">
            <ArrowLeft className="w-5 h-5 text-black" />
          </a>
          <div>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase italic">Medios de Pago</h1>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Configuración de Canales de Cobro</p>
          </div>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="px-8 py-4 bg-black text-white rounded-[20px] text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-3"
        >
          <Plus className="w-4 h-4" />
          Agregar Medio
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-10 h-10 border-4 border-zinc-100 border-t-black rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cargando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {methods.map(method => (
            <div key={method.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-black/5 hover:border-black/20 transition-all group relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 flex gap-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => handleOpenModal(method)} className="p-2 bg-zinc-50 hover:bg-black hover:text-white rounded-xl transition-all border border-zinc-100">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(method.id)} className="p-2 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all border border-rose-100 text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
               </div>

               <div className="mb-6">
                 <div className="w-16 h-16 rounded-[24px] flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform duration-500" style={{ backgroundColor: method.hexColor || '#000000' }}>
                   <CreditCard className="w-8 h-8" />
                 </div>
                 <div className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-3 ${method.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {method.isActive ? 'Activo' : 'Inactivo'}
                 </div>
                 <h3 className="text-xl font-black text-black uppercase italic tracking-tight">{method.name}</h3>
               </div>

               <div className="pt-6 border-t border-zinc-50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">ID: #{method.id}</span>
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-50 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-zinc-100 border-2 border-white"></div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10 relative animate-in slide-in-from-bottom-8 duration-500 font-oak">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute right-8 top-8 p-3 bg-zinc-50 hover:bg-zinc-100 rounded-[15px] transition-all"
            >
              <X className="w-4 h-4 text-black" />
            </button>

            <header className="mb-10">
              <h2 className="text-2xl font-black text-black uppercase italic tracking-tight">{editingMethod ? 'Editar Medio' : 'Nuevo Medio'}</h2>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-1">Detalles del Canal de Cobro</p>
              {error && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
                  <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse"></div>
                  <p className="text-[10px] font-black uppercase tracking-widest">{typeof error === 'string' ? error : 'Error de validación'}</p>
                </div>
              )}
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 block italic">Nombre del Medio</label>
                <div className="relative">
                  <Type className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300" />
                  <input 
                    type="text" 
                    required
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-[24px] pl-16 pr-8 py-5 text-sm font-bold focus:outline-none focus:border-black/10 transition-all font-oak"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej: Transferencia Bancaria"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 block italic">Color Identificador</label>
                  <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-100 rounded-[24px] p-2">
                    <input 
                      type="color" 
                      className="w-12 h-12 rounded-2xl cursor-pointer border-none bg-transparent"
                      value={formData.hexColor}
                      onChange={(e) => setFormData({...formData, hexColor: e.target.value})}
                    />
                    <span className="text-xs font-mono font-bold text-zinc-400 uppercase">{formData.hexColor}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 block italic">Estado Inicial</label>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                    className={`w-full py-5 rounded-[24px] text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${formData.isActive ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}
                  >
                    {formData.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {formData.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 rounded-[30px] border border-zinc-100 flex items-start gap-4">
                 <ShieldCheck className="w-6 h-6 text-black mt-1" />
                 <p className="text-[11px] text-zinc-400 font-medium leading-relaxed uppercase tracking-widest">
                    Los medios de pago activos aparecerán en el módulo de Cta. Corriente para registrar cobranzas masivamente.
                 </p>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={saving || !formData.name}
                  className="w-full py-6 bg-black text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:scale-100"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Zap className="w-4 h-4 fill-white" />
                  )}
                  {saving ? 'Procesando...' : (editingMethod ? 'Guardar Cambios' : 'Crear Medio de Pago')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethods;
