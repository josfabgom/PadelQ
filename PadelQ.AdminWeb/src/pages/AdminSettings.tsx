import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { Settings, Clock, DollarSign, Save, ChevronLeft, AlertCircle, LogOut, Trash2, ArrowLeft, Search } from 'lucide-react';
import Header from '../components/Header';

interface Setting {
  key: string;
  value: string;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [editedValues, setEditedValues] = useState<{ [key: string]: string }>({});
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserForWipe, setSelectedUserForWipe] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/api/SystemSettings', getAuthConfig());
      setSettings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users', getAuthConfig());
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, []);

  const handleSave = async (key: string) => {
    const value = editedValues[key] || settings.find(s => s.key === key)?.value;
    if (value === undefined) return;

    try {
      setSaving(key);
      await api.put('/api/SystemSettings', { key, value }, getAuthConfig());
      setMessage({ text: 'Configuración guardada correctamente', type: 'success' });
      fetchSettings();
    } catch (err) {
      setMessage({ text: 'Error al guardar configuración', type: 'error' });
    } finally {
      setSaving(null);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const handleWipeAccount = async () => {
    if (!selectedUserForWipe) return;
    if (!window.confirm(`¿Estás SEGURO de querer resetear la cuenta de ${selectedUserForWipe.fullName}? Se borrarán todos sus movimientos y pagos.`)) return;

    try {
      await api.post(`/api/transaction/reset-account/${selectedUserForWipe.id}`, {}, getAuthConfig());
      setMessage({ text: 'Cuenta reseteada con éxito', type: 'success' });
      setSelectedUserForWipe(null);
      setUserSearch('');
    } catch (err) {
      setMessage({ text: 'Error al resetear cuenta', type: 'error' });
    }
  };

  const handleWipeAllBookings = async () => {
    if (!window.confirm('¿ELIMINAR TODAS LAS RESERVAS DEL SISTEMA? Esta acción no se puede deshacer.')) return;

    try {
      await api.post('/api/bookings/wipe-all', {}, getAuthConfig());
      setMessage({ text: 'Todas las reservas han sido eliminadas', type: 'success' });
    } catch (err) {
      setMessage({ text: 'Error al realizar la limpieza global', type: 'error' });
    }
  };

  const handleChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const getSettingValue = (key: string, defaultValue: string) => {
    if (editedValues[key] !== undefined) return editedValues[key];
    return settings.find(s => s.key === key)?.value || defaultValue;
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
      <Header />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Configuración del Sistema</h1>
            <p className="text-slate-500 uppercase tracking-wider font-medium">HORARIOS OPERATIVOS Y PRECIOS GLOBALES</p>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Horarios Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Horarios de Atención</h2>
                <p className="text-sm text-slate-500">Define el rango horario para reservas</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SettingInput 
                  label="Hora de Apertura" 
                  value={getSettingValue('OpenHour', '8')} 
                  onChange={(val: string) => handleChange('OpenHour', val)}
                  onSave={() => handleSave('OpenHour')}
                  icon={<Clock className="w-4 h-4" />}
                  suffix=":00 hs"
                  type="number"
                />
                <SettingInput 
                  label="Hora de Cierre" 
                  value={getSettingValue('CloseHour', '23')} 
                  onChange={(val: string) => handleChange('CloseHour', val)}
                  onSave={() => handleSave('CloseHour')}
                  icon={<Clock className="w-4 h-4" />}
                  suffix=":00 hs"
                  type="number"
                />
              </div>
            </div>
          </div>

          {/* Precios Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Tarifas Base</h2>
                <p className="text-sm text-slate-500">Configura los precios predeterminados</p>
              </div>
            </div>

            <div className="space-y-6">
              <SettingInput 
                label="Precio por Hora (Cancha)" 
                value={getSettingValue('PricePerHour', '0')} 
                onChange={(val: string) => handleChange('PricePerHour', val)}
                onSave={() => handleSave('PricePerHour')}
                icon={<DollarSign className="w-4 h-4" />}
                prefix="$"
                type="number"
              />
            </div>
          </div>

          {/* Facturación Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Automatización de Cuotas</h2>
                <p className="text-sm text-slate-500">Configura la generación automática de deuda</p>
              </div>
            </div>

            <div className="space-y-6">
              <SettingInput 
                label="Días de Anticipación para Cuotas" 
                value={getSettingValue('BillingToleranceDays', '5')} 
                onChange={(val: string) => handleChange('BillingToleranceDays', val)}
                onSave={() => handleSave('BillingToleranceDays')}
                icon={<Clock className="w-4 h-4" />}
                suffix="días antes"
                type="number"
              />
            </div>
          </div>

          {/* Herramientas de Mantenimiento Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8 lg:col-span-2">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Herramientas de Mantenimiento</h2>
                <p className="text-sm text-slate-500">Acciones críticas de limpieza de datos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Reset Cliente */}
                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Resetear Cuenta Corriente</h4>
                        <div className="relative mb-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Buscar cliente..."
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                value={userSearch}
                                onChange={(e) => {
                                    setUserSearch(e.target.value);
                                    setSelectedUserForWipe(null);
                                }}
                            />
                            {userSearch && !selectedUserForWipe && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto overflow-x-hidden">
                                    {users.filter(u => u.fullName.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                                        <button 
                                            key={u.id}
                                            onClick={() => {
                                                setSelectedUserForWipe(u);
                                                setUserSearch(u.fullName);
                                            }}
                                            className="w-full p-4 text-left hover:bg-slate-50 text-xs font-bold uppercase transition-all flex justify-between items-center"
                                        >
                                            {u.fullName}
                                            <span className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-400">{u.dni}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={handleWipeAccount}
                        disabled={!selectedUserForWipe}
                        className="w-full py-4 bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-20 disabled:grayscale transition-all hover:bg-rose-600 flex items-center justify-center gap-3 active:scale-95"
                    >
                        <Trash2 className="w-4 h-4" />
                        Limpiar Cuenta Corriente
                    </button>
                    <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed text-center">
                        * Esta acción borrará todos los pagos y cargos del cliente seleccionado.
                    </p>
                </div>

                {/* Reset General */}
                <div className="p-6 bg-rose-50/30 rounded-[32px] border border-rose-100 space-y-6 flex flex-col justify-between">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-2">Limpieza Global</h4>
                        <p className="text-sm font-bold text-rose-800 leading-tight">Borrar todas las reservas del sistema históricas y futuras.</p>
                    </div>
                    <div className="space-y-4">
                        <button 
                            onClick={handleWipeAllBookings}
                            className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <Trash2 className="w-4 h-4" />
                            Limpiar Sistema de Reservas
                        </button>
                        <p className="text-[9px] text-rose-400 font-bold uppercase leading-relaxed text-center">
                            * Solo personal autorizado. Acción irreversible.
                        </p>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingInput = ({ label, value, onChange, onSave, icon, prefix, suffix, type = "text" }: any) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</label>
    <div className="flex gap-2">
      <div className="relative flex-1">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <div className="flex items-center">
            {prefix && <span className="absolute left-10 top-1/2 -translate-y-1/2 font-bold text-slate-900">{prefix}</span>}
            <input 
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full ${prefix ? 'pl-14' : 'pl-10'} pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-900`}
            />
            {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{suffix}</span>}
        </div>
      </div>
      <button 
        onClick={onSave}
        className="px-6 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
      >
        Guardar
      </button>
    </div>
  </div>
);

export default AdminSettings;
