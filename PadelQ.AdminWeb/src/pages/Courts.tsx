import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { Layout, Plus, Edit2, Trash2, Check, X, Shield, MapPin, DollarSign, LogOut } from 'lucide-react';
import Header from '../components/Header';

interface Court {
  id: number;
  name: string;
  isIndoor: boolean;
  surfaceType: string;
  pricePerHour: number;
  isActive: boolean;
}

const CourtsPage = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [formData, setFormData] = useState<Partial<Court>>({
    name: '',
    isIndoor: false,
    surfaceType: 'Glass',
    pricePerHour: 25,
    isActive: true
  });

  const config = getAuthConfig();

  useEffect(() => {
    fetchCourts();
  }, []);

  const fetchCourts = async () => {
    try {
      const response = await api.get('/api/courts', config);
      setCourts(response.data);
    } catch (err) {
      console.error("Error al cargar canchas", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (court?: Court) => {
    if (court) {
      setEditingCourt(court);
      setFormData(court);
    } else {
      setEditingCourt(null);
      setFormData({ name: '', isIndoor: false, surfaceType: 'Glass', pricePerHour: 25, isActive: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourt) {
        await api.put(`/api/courts/${editingCourt.id}`, formData, config);
      } else {
        await api.post('/api/courts', formData, config);
      }
      setIsModalOpen(false);
      fetchCourts();
    } catch (err) {
      console.error("Error al guardar cancha", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar esta cancha?')) {
      try {
        await api.delete(`/api/courts/${id}`, config);
        fetchCourts();
      } catch (err) {
        console.error("Error al eliminar cancha", err);
      }
    }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
      <Header />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Canchas</h1>
          <p className="text-slate-500">ADMINISTRA LAS CANCHAS DISPONIBLES Y SUS PRECIOS</p>
        </div>
        
        <div className="flex gap-4">
          <a href="/dashboard" className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Volver
          </a>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Cancha
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courts.map((court) => (
            <div key={court.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative">
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${court.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {court.isActive ? 'Activa' : 'Inactiva'}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenModal(court)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {roles.includes('Admin') && (
                    <button onClick={() => handleDelete(court.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">{court.name}</h3>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{court.isIndoor ? 'Techada' : 'Al aire libre'} - {court.surfaceType}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-indigo-600 bg-indigo-50 p-3 rounded-xl">
                  <DollarSign className="w-4 h-4" />
                  <span>Precio: ${court.pricePerHour} / hora</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900">{editingCourt ? 'Editar Cancha' : 'Nueva Cancha'}</h2>
              <p className="text-slate-500 text-sm">Ingresa los detalles de la cancha</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre de la Cancha</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej: Cancha Central"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Superficie</label>
                  <select 
                    value={formData.surfaceType}
                    onChange={(e) => setFormData({...formData, surfaceType: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="Glass">Cristal</option>
                    <option value="Concrete">Muro</option>
                    <option value="Panorámica">Panorámica</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Precio por Hora</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="number" 
                      value={formData.pricePerHour}
                      onChange={(e) => setFormData({...formData, pricePerHour: Number(e.target.value)})}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex-1 flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.isIndoor}
                    onChange={(e) => setFormData({...formData, isIndoor: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Techada</span>
                </label>
                <label className="flex-1 flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Activa</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
                >
                  {editingCourt ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourtsPage;
