import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
  Plus, 
  X, 
  DollarSign, 
  LayoutGrid,
  Edit2,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import Header from '../components/Header';

interface Space {
  id: number;
  name: string;
  description: string;
  pricePerSlot: number;
  isActive: boolean;
}

const ManageSpacesPage = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [spaceFormData, setSpaceFormData] = useState({ name: '', description: '', pricePerSlot: 0, isActive: true });

  const config = getAuthConfig();

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/spaces', config);
      setSpaces(res.data);
    } catch (err) {
      console.error("Error al cargar espacios", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSpaceModal = (space?: Space) => {
    if (space) {
      setEditingSpace(space);
      setSpaceFormData({ ...space });
    } else {
      setEditingSpace(null);
      setSpaceFormData({ name: '', description: '', pricePerSlot: 0, isActive: true });
    }
    setIsSpaceModalOpen(true);
  };

  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSpace) {
        await api.put(`/api/spaces/${editingSpace.id}`, spaceFormData, config);
      } else {
        await api.post('/api/spaces', spaceFormData, config);
      }
      setIsSpaceModalOpen(false);
      fetchSpaces();
    } catch (err) {
      console.error("Error al guardar espacio", err);
    }
  };

  const handleDeleteSpace = async (id: number) => {
    if (window.confirm('¿Eliminar este espacio?')) {
      await api.delete(`/api/spaces/${id}`, config);
      fetchSpaces();
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#fafafa] min-h-screen font-oak">
      <Header />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-4xl font-black text-black tracking-tight mb-1 uppercase italic">Administración de Espacios</h1>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Gestión de Unidades (Quinchos, Parrillas, Salones)</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <button 
                onClick={() => handleOpenSpaceModal()}
                className="group border-4 border-dashed border-zinc-200 rounded-[40px] p-8 flex flex-col items-center justify-center gap-4 hover:border-black hover:bg-black transition-all duration-500 min-h-[280px]"
            >
                <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center group-hover:bg-white/10 group-hover:scale-110 transition-all duration-500">
                    <Plus className="w-8 h-8 text-zinc-400 group-hover:text-white" />
                </div>
                <div className="text-center">
                    <p className="font-black uppercase italic text-zinc-400 group-hover:text-white tracking-tight">Agregar Nuevo</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 group-hover:text-white/40">Quincho, Parilla, etc.</p>
                </div>
            </button>

            {spaces.map(space => (
                <div key={space.id} className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${space.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {space.isActive ? 'Operativo' : 'Mantenimiento'}
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => handleOpenSpaceModal(space)} className="p-3 bg-zinc-50 text-zinc-400 hover:bg-black hover:text-white rounded-2xl transition-all"><Edit2 className="w-4 h-4"/></button>
                             <button onClick={() => handleDeleteSpace(space.id)} className="p-3 bg-zinc-50 text-zinc-400 hover:bg-rose-600 hover:text-white rounded-2xl transition-all"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    </div>

                    <h3 className="text-2xl font-black text-black uppercase italic tracking-tight mb-2">{space.name}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-8">{space.description}</p>
                    
                    <div className="flex items-center gap-4 p-4 bg-zinc-50 rounded-3xl border border-zinc-100 group-hover:bg-black transition-all duration-500">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <DollarSign className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-white/40">Precio Base</p>
                            <p className="text-lg font-black text-black italic group-hover:text-white">${space.pricePerSlot}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* Space ABM Modal */}
      {isSpaceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden scale-in-center">
                <div className="p-10 bg-zinc-50 border-b border-zinc-100 relative">
                    <button onClick={() => setIsSpaceModalOpen(false)} className="absolute right-8 top-8 p-2 hover:bg-zinc-200 rounded-xl transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <h2 className="text-2xl font-black text-black uppercase italic tracking-tight">{editingSpace ? 'Editar Espacio' : 'Nuevo Espacio'}</h2>
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Define las características del área</p>
                </div>
                <form onSubmit={handleSaveSpace} className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nombre del Espacio</label>
                        <input type="text" value={spaceFormData.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpaceFormData({...spaceFormData, name: e.target.value})} required className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold placeholder:font-normal" placeholder="Ej: Quincho Principal" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Descripción</label>
                        <textarea value={spaceFormData.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpaceFormData({...spaceFormData, description: e.target.value})} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold h-32 placeholder:font-normal" placeholder="Detalles, capacidad, etc." />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Precio Base por Alquiler</label>
                        <input type="number" value={spaceFormData.pricePerSlot} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpaceFormData({...spaceFormData, pricePerSlot: Number(e.target.value)})} required className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold" />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={() => setIsSpaceModalOpen(false)} className="flex-1 py-4 bg-zinc-50 text-zinc-400 rounded-2xl font-black uppercase tracking-widest">Cancelar</button>
                        <button type="submit" className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Guardar Espacio</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ManageSpacesPage;
