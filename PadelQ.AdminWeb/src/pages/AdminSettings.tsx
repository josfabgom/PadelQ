import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { Settings, Clock, DollarSign, Save, ChevronLeft, AlertCircle, LogOut, Trash2 } from 'lucide-react';
import Header from '../components/Header';

interface Setting {
  key: string;
  value: string;
}

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const config = getAuthConfig();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/api/systemsettings', config);
      setSettings(response.data);
    } catch (err) {
      console.error("Error al cargar settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
  };

  const handleSave = async (key: string) => {
    const setting = settings.find(s => s.key === key);
    if (!setting) return;

    setSaving(true);
    try {
      await api.put('/api/systemsettings', setting, config);
      setMessage({ text: `Configuración "${key}" guardada correctamente.`, type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Error al guardar configuración.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getSettingValue = (key: string, defaultValue: string) => {
    return settings.find(s => s.key === key)?.value || defaultValue;
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
      <Header />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configuración del Sistema</h1>
          <p className="text-slate-500">HORARIOS OPERATIVOS Y PRECIOS GLOBALES</p>
        </div>
        
        <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Volver al Dashboard
        </a>
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
                  onChange={(val) => handleChange('OpenHour', val)}
                  onSave={() => handleSave('OpenHour')}
                  icon={<Clock className="w-4 h-4" />}
                  suffix=":00 hs"
                  type="number"
                />
                <SettingInput 
                  label="Hora de Cierre" 
                  value={getSettingValue('CloseHour', '23')} 
                  onChange={(val) => handleChange('CloseHour', val)}
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
                <h2 className="text-xl font-bold text-slate-800">Precios Predeterminados</h2>
                <p className="text-sm text-slate-500">Se aplicará si la cancha no tiene precio específico</p>
              </div>
            </div>

            <div className="space-y-6">
              <SettingInput 
                label="Precio Base por Hora" 
                value={getSettingValue('PricePerHour', '25')} 
                onChange={(val) => handleChange('PricePerHour', val)}
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
                onChange={(val) => handleChange('BillingToleranceDays', val)}
                onSave={() => handleSave('BillingToleranceDays')}
                icon={<Clock className="w-4 h-4" />}
                suffix="días antes"
                type="number"
              />
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-rose-100 bg-rose-50/20 space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-rose-900">Zona de Peligro</h2>
                <p className="text-sm text-rose-600/70">Acciones destructivas irreversibles</p>
              </div>
            </div>

            <div className="space-y-6">
                <div className="p-6 bg-white border border-rose-200 rounded-3xl space-y-4 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-rose-50 text-rose-500 rounded-lg">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Vaciar Calendario de Reservas</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Elimina permanentemente **todas** las reservas del sistema. Úsalo solo para limpiezas de mantenimiento.
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={async () => {
                            if(confirm("¡ATENCIÓN! ¿Estás seguro de que quieres BORRAR TODAS las reservas? Esta acción no se puede deshacer.")) {
                                try {
                                    await api.post('/api/bookings/wipe-all', {}, config);
                                    setMessage({ text: "Base de datos de reservas limpiada con éxito.", type: 'success' });
                                    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
                                } catch (e: any) {
                                    const errorMsg = e.response?.data?.message || e.response?.data || e.message;
                                    setMessage({ text: "Error: " + errorMsg, type: 'error' });
                                }
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl transition-all shadow-lg shadow-rose-200 font-bold"
                    >
                        <Trash2 className="w-5 h-5" />
                        VACIAR TODO EL CALENDARIO
                    </button>
                </div>
            </div>
          </div>
        </div>

      )}
    </div>
  );
};

interface SettingInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  icon: React.ReactNode;
  prefix?: string;
  suffix?: string;
  type?: string;
}

const SettingInput = ({ label, value, onChange, onSave, icon, prefix, suffix, type = 'text' }: SettingInputProps) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    <div className="flex gap-2">
      <div className="relative flex-1">
        {prefix && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefix}</div>}
        <input 
          type={type} 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full ${prefix ? 'pl-8' : 'px-4'} ${suffix ? 'pr-20' : 'pr-4'} py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium`}
        />
        {suffix && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{suffix}</div>}
      </div>
      <button 
        onClick={onSave}
        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/10"
      >
        <Save className="w-5 h-5" />
      </button>
    </div>
  </div>
);

export default AdminSettingsPage;
