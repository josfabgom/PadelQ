import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { CreditCard, Plus, Trash2, Edit3, Save, X, RefreshCw, LogOut, ArrowLeft } from 'lucide-react';
import Header from '../components/Header';

interface Membership {
  id?: number;
  name?: string;
  monthlyPrice?: number;
  discountPercentage?: number;
  description?: string;
  hexColor?: string;
  // Fallback for API response (temp)
  Name?: string;
  MonthlyPrice?: number;
  DiscountPercentage?: number;
  Description?: string;
  HexColor?: string;
}

const MembershipsPage = () => {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    monthlyPrice: 0,
    discountPercentage: 0,
    description: '',
    hexColor: '#6366f1'
  });

  const fetchMemberships = async () => {
    const config = getAuthConfig();
    if (!config.headers.Authorization) {
        window.location.href = '/login';
        return;
    }
    try {
      const response = await api.get('/api/membership', config);
      setMemberships(response.data);
    } catch (err: any) {
      console.error("Error al cargar membresías", err);
      if (err.response?.status === 401) {
        alert("Sesión expirada o no autorizada. Por favor, inicia sesión de nuevo.");
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const config = getAuthConfig();
    if (!config.headers.Authorization) return;

    try {
      const payload = {
        id: editingMembership?.id || 0,
        name: formData.name,
        monthlyPrice: formData.monthlyPrice,
        discountPercentage: formData.discountPercentage,
        description: formData.description,
        hexColor: formData.hexColor
      };

      if (editingMembership) {
        await api.put(`/api/membership/${editingMembership.id}`, payload, config);
      } else {
        await api.post('/api/membership', payload, config);
      }
      setIsModalOpen(false);
      setEditingMembership(null);
      setFormData({ name: '', monthlyPrice: 0, discountPercentage: 0, description: '', hexColor: '#6366f1' });
      fetchMemberships();
    } catch (err: any) {
      console.error("Error al guardar membresía", err);
      const status = err.response?.status;
      const data = err.response?.data;
      
      let msg = `Error ${status}: `;
      if (status === 401) msg += "No estás autenticado o la sesión expiró.";
      else if (status === 403) msg += "No tienes permisos de Administrador para realizar esta acción.";
      else msg += typeof data === 'string' ? data : JSON.stringify(data || err.message);
      
      alert(msg);
      if (status === 401) window.location.href = '/login';
    }
  };

  const handleEdit = (membership: Membership) => {
    setEditingMembership(membership);
    setFormData({
      name: membership.name || membership.Name || '',
      monthlyPrice: membership.monthlyPrice || membership.MonthlyPrice || 0,
      discountPercentage: membership.discountPercentage ?? membership.DiscountPercentage ?? 0,
      description: membership.description || membership.Description || '',
      hexColor: membership.hexColor || membership.HexColor || '#6366f1'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este plan?")) return;
    const config = getAuthConfig();
    if (!config) return;

    try {
      await api.delete(`/api/membership/${id}`, config);
      fetchMemberships();
    } catch (err: any) {
      console.error("Error al eliminar membresía", err);
      alert(err.response?.data || "Error al eliminar la membresía.");
    }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
      <Header />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Planes de Membresía</h1>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Configura los beneficios para tus clientes</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={async () => {
              if(!window.confirm("¿Desea generar las cuotas mensuales para todos los socios activos?")) return;
              try {
                const config = getAuthConfig();
                if (!config.headers.Authorization) return;
                const res = await api.post('/api/membership/run-billing', {}, config);
                alert(`Proceso completado: ${res.data.chargesGenerated} cuotas generadas.`);
              } catch (err) {
                console.error(err);
                alert("Error al ejecutar la facturación.");
              }
            }}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Facturación Mensual
          </button>
          <button 
            onClick={() => {
              setEditingMembership(null);
              setFormData({ name: '', monthlyPrice: 0, discountPercentage: 0, description: '', hexColor: '#6366f1' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus className="w-5 h-5" />
            Nuevo Plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memberships.map((membership) => (
            <div key={membership.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${membership.hexColor || membership.HexColor || '#6366f1'}20`, color: membership.hexColor || membership.HexColor || '#6366f1' }}>
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEdit(membership)}
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => membership.id && handleDelete(membership.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{membership.name || membership.Name}</h3>
              <p className="text-slate-500 text-sm mt-2 mb-4 h-10 overflow-hidden">
                {(membership.description || membership.Description) || 'Sin descripción'}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-indigo-600">
                  ${membership.monthlyPrice || membership.MonthlyPrice}
                </span>
                <span className="text-slate-400 text-sm font-medium">/mes</span>
              </div>
              <div className="mt-2 text-emerald-600 font-bold text-sm">
                Descuento en Alquiler/Actividades: {membership.discountPercentage ?? membership.DiscountPercentage ?? 0}%
              </div>
            </div>
          ))}
          {memberships.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400">No hay planes creados todavía.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Nueva Membresía */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">
                {editingMembership ? 'Editar Plan de Membresía' : 'Nuevo Plan de Membresía'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Plan</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Ej: Socio Oro"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Precio Mensual ($)</label>
                <p className="text-xs text-slate-500 mb-2">Costo que el usuario paga por el plan</p>
                <input 
                  type="number" 
                  required
                  value={formData.monthlyPrice}
                  onChange={(e) => setFormData({...formData, monthlyPrice: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Beneficio de Descuento (%)</label>
                <p className="text-xs text-slate-500 mb-2">Descuento aplicado a alquileres y actividades</p>
                <input 
                  type="number" 
                  required
                  min="0"
                  max="100"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({...formData, discountPercentage: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0"
                />
              </div>
               <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Color del Plan</label>
                <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <input 
                    type="color" 
                    value={formData.hexColor}
                    onChange={(e) => setFormData({...formData, hexColor: e.target.value})}
                    className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={formData.hexColor}
                    onChange={(e) => setFormData({...formData, hexColor: e.target.value})}
                    className="flex-1 bg-transparent border-0 outline-none font-mono text-sm uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Descripción</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  placeholder="Describe los beneficios..."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
                >
                  {editingMembership ? 'Actualizar Plan' : 'Crear Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipsPage;
