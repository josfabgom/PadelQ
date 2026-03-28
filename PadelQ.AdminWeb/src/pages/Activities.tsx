import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layout, Plus, Edit2, Trash2, Check, X, Calendar, Clock, User, DollarSign, Users } from 'lucide-react';

interface ActivitySchedule {
  id?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ClubActivity {
  id?: number;
  name: string;
  description: string;
  instructorName: string;
  price: number;
  maxCapacity: number;
  isActive: boolean;
  schedules: ActivitySchedule[];
}

const ActivitiesPage = () => {
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ClubActivity | null>(null);
  const [formData, setFormData] = useState<ClubActivity>({
    name: '',
    description: '',
    instructorName: '',
    price: 30,
    maxCapacity: 10,
    isActive: true,
    schedules: []
  });

  const token = localStorage.getItem('padelq_token');
  const config = { headers: { Authorization: `Bearer ${token}` } };
  const API_URL = 'http://localhost:5041/api/activities';

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await axios.get(API_URL, config);
      setActivities(response.data);
    } catch (err) {
      console.error("Error al cargar actividades", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (activity?: ClubActivity) => {
    if (activity) {
      setEditingActivity(activity);
      setFormData(activity);
    } else {
      setEditingActivity(null);
      setFormData({
        name: '',
        description: '',
        instructorName: '',
        price: 30,
        maxCapacity: 10,
        isActive: true,
        schedules: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingActivity) {
        await axios.put(`${API_URL}/${editingActivity.id}`, formData, config);
      } else {
        await axios.post(API_URL, formData, config);
      }
      setIsModalOpen(false);
      fetchActivities();
    } catch (err) {
      console.error("Error al guardar actividad", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar esta actividad?')) {
      try {
        await axios.delete(`${API_URL}/${id}`, config);
        fetchActivities();
      } catch (err) {
        console.error("Error al eliminar actividad", err);
      }
    }
  };

  const addSchedule = () => {
    setFormData({
      ...formData,
      schedules: [
        ...formData.schedules,
        { dayOfWeek: 1, startTime: '10:00:00', endTime: '11:00:00' }
      ]
    });
  };

  const removeSchedule = (index: number) => {
    const newSchedules = formData.schedules.filter((_, i) => i !== index);
    setFormData({ ...formData, schedules: newSchedules });
  };

  const updateSchedule = (index: number, field: keyof ActivitySchedule, value: any) => {
    const newSchedules = [...formData.schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    setFormData({ ...formData, schedules: newSchedules });
  };

  const getDayName = (day: number) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[day];
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Actividades y Clases</h1>
          <p className="text-slate-500">GESTIONA LAS CLASES GRUPALES Y ACTIVIDADES DEL CLUB</p>
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
            Nueva Actividad
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative">
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${activity.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {activity.isActive ? 'Activa' : 'Inactiva'}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenModal(activity)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(activity.id!)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">{activity.name}</h3>
              <p className="text-slate-500 text-sm mb-4 line-clamp-2">{activity.description}</p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Profesor: {activity.instructorName}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>Capacidad: {activity.maxCapacity} personas</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {activity.schedules.map((s, i) => (
                    <div key={i} className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-[10px] rounded-lg">
                      <Calendar className="w-3 h-3" />
                      <span>{getDayName(s.dayOfWeek)} {s.startTime.substring(0,5)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-indigo-600 bg-indigo-50 p-3 rounded-xl mt-4">
                  <DollarSign className="w-4 h-4" />
                  <span>Precio: ${activity.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-100 shrink-0">
              <h2 className="text-2xl font-bold text-slate-900">{editingActivity ? 'Editar Actividad' : 'Nueva Actividad'}</h2>
              <p className="text-slate-500 text-sm">Gestiona la información y los horarios de la clase</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre de la Actividad</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Ej: Clase de Pádel Principiantes"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                      placeholder="Breve descripción de la actividad..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profesor / Instructor</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        value={formData.instructorName}
                        onChange={(e) => setFormData({...formData, instructorName: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Precio</label>
                      <input 
                        type="number" 
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Max Capacidad</label>
                      <input 
                        type="number" 
                        value={formData.maxCapacity}
                        onChange={(e) => setFormData({...formData, maxCapacity: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horarios Semanales</label>
                    <button 
                      type="button" 
                      onClick={addSchedule}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Añadir Día
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.schedules.map((schedule, index) => (
                      <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative group">
                        <button 
                          type="button" 
                          onClick={() => removeSchedule(index)}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="space-y-3">
                          <select 
                            value={schedule.dayOfWeek}
                            onChange={(e) => updateSchedule(index, 'dayOfWeek', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                          >
                            <option value={1}>Lunes</option>
                            <option value={2}>Martes</option>
                            <option value={3}>Miércoles</option>
                            <option value={4}>Jueves</option>
                            <option value={5}>Viernes</option>
                            <option value={6}>Sábado</option>
                            <option value={0}>Domingo</option>
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                              <input 
                                type="time" 
                                value={schedule.startTime.substring(0,5)}
                                onChange={(e) => updateSchedule(index, 'startTime', e.target.value + ':00')}
                                className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                            <div className="relative">
                              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                              <input 
                                type="time" 
                                value={schedule.endTime.substring(0,5)}
                                onChange={(e) => updateSchedule(index, 'endTime', e.target.value + ':00')}
                                className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {formData.schedules.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                        No hay horarios definidos
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 shrink-0 bg-white">
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
                  {editingActivity ? 'Guardar Cambios' : 'Crear Actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitiesPage;
