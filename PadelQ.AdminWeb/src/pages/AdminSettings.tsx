import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { Settings, Clock, DollarSign, Save, ChevronLeft, AlertCircle, LogOut, Trash2, ArrowLeft, Search, History, CheckCircle2, Briefcase, Check, Mail, Phone, MapPin, Globe } from 'lucide-react';
import Header from '../components/Header';
import { UPDATE_HISTORY, SYSTEM_VERSION } from '../constants/versions';

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [foundBookings, setFoundBookings] = useState<any[] | null>(null);
  const [companyInfo, setCompanyInfo] = useState({
    name: 'PadelQ',
    address: '',
    phone: '',
    email: '',
    website: ''
  });

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
    const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]').map((r: string) => r.toLowerCase());
    if (!roles.includes('admin')) {
      window.location.href = '/dashboard';
      return;
    }
    setIsAdmin(true);
    fetchSettings();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (settings.length > 0) {
      const info = { ...companyInfo };
      settings.forEach(s => {
        if (s.key === 'CompanyName') info.name = s.value;
        if (s.key === 'CompanyAddress') info.address = s.value;
        if (s.key === 'CompanyPhone') info.phone = s.value;
        if (s.key === 'CompanyEmail') info.email = s.value;
        if (s.key === 'CompanyWebsite') info.website = s.value;
      });
      setCompanyInfo(info);
    }
  }, [settings]);

  const handleSaveCompanyInfo = async () => {
    try {
      const bulkSettings = [
        { key: 'CompanyName', value: companyInfo.name },
        { key: 'CompanyAddress', value: companyInfo.address },
        { key: 'CompanyPhone', value: companyInfo.phone },
        { key: 'CompanyEmail', value: companyInfo.email },
        { key: 'CompanyWebsite', value: companyInfo.website }
      ];
      await api.post('/api/systemsettings/bulk', bulkSettings, getAuthConfig());
      setMessage({ text: "Información de la empresa guardada. Se recomienda recargar la página.", type: 'success' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setMessage({ text: "Error al guardar información", type: 'error' });
    }
  };

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
    } catch (err: any) {
      const errorMsg = err.response?.data?.Message || err.response?.data || err.message;
      setMessage({ text: 'Error: ' + errorMsg, type: 'error' });
      alert('Error detallado: ' + (typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg));
    }
  };

  const handleWipeAllBookings = async () => {
    if (!window.confirm('¿ELIMINAR TODAS LAS RESERVAS DEL SISTEMA? Esta acción no se puede deshacer.')) return;

    try {
      await api.post('/api/bookings/wipe-all', {}, getAuthConfig());
      setMessage({ text: 'Todas las reservas han sido eliminadas', type: 'success' });
    } catch (err: any) {
      const errorMsg = err.response?.data?.Message || err.response?.data || err.message;
      setMessage({ text: 'Error: ' + errorMsg, type: 'error' });
      alert('Error detallado: ' + (typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg));
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
          {/* Company Info Section */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8 lg:col-span-2">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-black text-white rounded-2xl">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Datos de la Empresa</h2>
                <p className="text-sm text-slate-500">Configuración global del club (aparece en tickets y encabezados)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del Club / Empresa</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={companyInfo.name}
                    onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})}
                    className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dirección Física</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={companyInfo.address}
                    onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})}
                    className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono / WhatsApp</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={companyInfo.phone}
                    onChange={e => setCompanyInfo({...companyInfo, phone: e.target.value})}
                    className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email de Contacto</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input 
                    type="email" 
                    value={companyInfo.email}
                    onChange={e => setCompanyInfo({...companyInfo, email: e.target.value})}
                    className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sitio Web / Instagram</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={companyInfo.website}
                    onChange={e => setCompanyInfo({...companyInfo, website: e.target.value})}
                    className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="www.tusitio.com"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveCompanyInfo}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200"
            >
              <CheckCircle2 className="w-5 h-5" /> Guardar Datos de la Empresa
            </button>
          </div>

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
              </div>
              <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Resetear Pagos de Turno</h4>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                        <input 
                        type="date"
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold"
                        id="reset-date"
                        defaultValue={new Date().toISOString().split('T')[0]}
                        />
                        <button 
                        onClick={async () => {
                            const date = (document.getElementById('reset-date') as HTMLInputElement).value;
                            try {
                                const res = await api.get(`/api/bookings/by-date?date=${date}`, getAuthConfig());
                                const sres = await api.get(`/api/spacebookings/by-date?date=${date}`, getAuthConfig());
                                const all = [...res.data.map((b: any) => ({...b, type: 'Cancha'})), ...sres.data.map((b: any) => ({...b, type: 'Espacio'}))];
                                setFoundBookings(all);
                                setMessage({ text: `Se encontraron ${all.length} turnos para esa fecha.`, type: 'success' });
                            } catch (err) {
                                setMessage({ text: 'Error al buscar turnos', type: 'error' });
                            }
                        }}
                        className="px-6 bg-black text-white rounded-2xl text-[10px] font-black uppercase"
                        >
                        Buscar
                        </button>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-2">
                        {foundBookings?.map((b: any) => (
                            <div key={b.id} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black italic uppercase">{b.type} - {new Date(b.startTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} hs</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{b.guestName || b.user?.fullName || 'S/N'}</p>
                                </div>
                                <button 
                                    onClick={async () => {
                                        console.log("Resetting booking:", b.id, b.type);
                                        if (!window.confirm(`¿Seguro que quieres borrar TODOS los pagos del turno de ${b.guestName || b.user?.fullName || 'este cliente'}?`)) return;
                                        
                                        try {
                                            const url = b.type === 'Cancha' ? `/api/bookings/${b.id}/reset-payment` : `/api/spacebookings/${b.id}/reset-payment`;
                                            await api.post(url, {}, getAuthConfig());
                                            setMessage({ text: 'Pagos reseteados correctamente', type: 'success' });
                                            setFoundBookings(null);
                                        } catch (err: any) {
                                            console.error("Error resetting payment:", err);
                                            alert("Error al resetear: " + (err.response?.data?.Message || err.message));
                                        }
                                    }}
                                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                                >
                                    Resetear
                                </button>
                            </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
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
                  <p className="text-[9px] text-rose-400 font-bold uppercase leading-relaxed text-center">* Solo personal autorizado. Acción irreversible.</p>
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
