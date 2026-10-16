import React, { useState, useEffect } from 'react';
import { Save, Server, ArrowLeft, CreditCard } from 'lucide-react';
import axios from 'axios';

// Usamos el proxy de vite o la url base del proyecto
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5041';
const API_URL = `${API_BASE_URL}/api/clover`;

const CloverSettings = () => {
  const [settings, setSettings] = useState<any>({
    isProduction: false,
    merchantId: '',
    accessToken: '',
    appId: '',
    appSecret: ''
  });
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '', isError: false });

  const showModal = (title: string, message: string, isError: boolean = false) => {
    setModalState({ isOpen: true, title, message, isError });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('padelq_token');
      const res = await axios.get(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${token}` } });
      setSettings(res.data);
    } catch (err) {
      console.error('Error fetching settings', err);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('padelq_token');
      await axios.post(`${API_URL}/settings`, settings, { headers: { Authorization: `Bearer ${token}` } });
      showModal('Éxito', 'Configuración de Clover guardada exitosamente.');
    } catch (err) {
      showModal('Error', 'Error al guardar configuración.', true);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDevice = async () => {
    try {
      const token = localStorage.getItem('padelq_token');
      await axios.post(`${API_URL}/device`, { deviceId }, { headers: { Authorization: `Bearer ${token}` } });
      showModal('Éxito', 'Dispositivo de caja guardado con éxito.');
    } catch (err) {
      showModal('Error', 'Error al vincular caja.', true);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-green-600" />
            Configuración de Clover
          </h1>
          <p className="text-gray-500 mt-1">Administra tus credenciales de Clover (Cloud Pay Display API)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-500" />
            Credenciales API
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
            <input
              type="checkbox"
              id="isProduction"
              checked={settings.isProduction}
              onChange={e => setSettings({ ...settings, isProduction: e.target.checked })}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
            />
            <label htmlFor="isProduction" className="ml-3 font-medium cursor-pointer">
              Modo Producción Activo
            </label>
            <span className="ml-2 text-sm opacity-80">(Desmarca para usar Sandbox/Pruebas)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID</label>
              <input
                type="text"
                value={settings.merchantId || ''}
                onChange={e => setSettings({ ...settings, merchantId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Ej: AB12CD34EF56"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <input
                type="password"
                value={settings.accessToken || ''}
                onChange={e => setSettings({ ...settings, accessToken: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Token de acceso (OAuth o generado)"
              />
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {isLoading ? 'Guardando...' : 'Guardar Credenciales'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-500" />
            Asignación de Caja Local
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clover Device ID de esta PC</label>
            <div className="flex gap-4">
              <input
                type="text"
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Ej: C031UQ12345678"
              />
              <button
                onClick={saveDevice}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 whitespace-nowrap"
              >
                Vincular Caja
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">Este código le dice al sistema a qué maquinita física enviar el cobro cuando tú presiones "Cobrar".</p>
          </div>
        </div>
      </div>

      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4 animate-in fade-in zoom-in duration-200">
            <h3 className={`text-xl font-bold mb-2 ${modalState.isError ? 'text-red-600' : 'text-green-600'}`}>
              {modalState.title}
            </h3>
            <p className="text-gray-600 mb-6">{modalState.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloverSettings;

