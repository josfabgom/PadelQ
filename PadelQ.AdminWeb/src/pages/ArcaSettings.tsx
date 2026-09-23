import React, { useState, useEffect } from 'react';
import { Save, Upload, Key, Server, CheckCircle2, AlertTriangle, ShieldCheck , ArrowLeft} from 'lucide-react';
import axios from 'axios';

// Assume API_URL is handled via proxy or env
const API_URL = 'http://localhost:5041/api/arca';

const ArcaSettings = () => {
  const [settings, setSettings] = useState<any>({
    isProduction: false,
    cuitEmisor: '',
    puntoDeVenta: 1,
    condicionIva: 'Responsable Inscripto',
    hasPrivateKey: false,
    hasCertificate: false
  });
  
  const [csrData, setCsrData] = useState({ cuit: '', commonName: '' });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
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
      const res = await axios.get(`${API_URL}/settings`);
      setSettings(res.data);
      setCsrData(prev => ({ ...prev, cuit: res.data.cuitEmisor }));
    } catch (err) {
      console.error('Error fetching settings', err);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      await axios.post(`${API_URL}/settings`, settings);
      showModal('Ã‰xito', 'Configuración guardada exitosamente.');
    } catch (err) {
      showModal('Error', 'Error al guardar configuración.', true);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCsr = async () => {
    if (!csrData.cuit || !csrData.commonName) {
      showModal('Atención', 'Completá CUIT y Nombre de Fantasía (Ej: miempresa)', true);
      return;
    }
    
    try {
      const res = await axios.post(`${API_URL}/generate-csr`, csrData, { responseType: 'blob' });
      // download file
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pedido_certificado_${csrData.cuit}.csr`);
      document.body.appendChild(link);
      link.click();
      
      // refresh status
      fetchSettings();
      showModal('Archivo Generado', 'Se descargó el archivo CSR y la clave privada se guardó segura en el sistema. Subí este archivo a AFIP para obtener el certificado (.crt).');
    } catch (err) {
      showModal('Error', 'Error al generar CSR.', true);
    }
  };

  const uploadCert = async () => {
    if (!certFile) return showModal('Atención', 'Selecciona un archivo .crt primero.', true);
    
    const formData = new FormData();
    formData.append('file', certFile);
    
    try {
      await axios.post(`${API_URL}/upload-certificate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showModal('Ã‰xito', 'Certificado subido correctamente.');
      fetchSettings();
    } catch (err) {
      showModal('Error', 'Error subiendo certificado.', true);
    }
  };

  const testConnection = async () => {
    try {
      setTestResult('Probando...');
      const res = await axios.post(`${API_URL}/test-connection`);
      if (res.data.success) {
        setTestResult('Conexión Exitosa con Servidores AFIP/ARCA.');
      } else {
        setTestResult('Error: No se pudo conectar.');
      }
    } catch (err) {
      setTestResult('Error de red al probar la conexión.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-6">
        <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
          <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
        </a>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Facturación Electrónica (ARCA)</h1>
          <p className="text-sm text-zinc-500 mt-1">Configuración y gestión de certificados digitales</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PARÃMETROS GENERALES */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xl shadow-zinc-200/20">
          <h2 className="text-lg font-black tracking-tight text-zinc-800 mb-6 flex items-center gap-2">
            <Server className="w-5 h-5 text-black" />
            Parámetros Generales
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Entorno</label>
              <select 
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-black"
                value={settings.isProduction ? 'true' : 'false'}
                onChange={(e) => setSettings({...settings, isProduction: e.target.value === 'true'})}
              >
                <option value="false">Homologación (Testing)</option>
                <option value="true">Producción (Ventas Reales)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Condición IVA</label>
              <select 
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-black"
                value={settings.condicionIva}
                onChange={(e) => setSettings({...settings, condicionIva: e.target.value})}
              >
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Sujeto Exento">Sujeto Exento</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">CUIT Emisor</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-black"
                  value={settings.cuitEmisor}
                  onChange={(e) => setSettings({...settings, cuitEmisor: e.target.value})}
                  placeholder="Sin guiones"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Punto de Venta</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-black"
                  value={settings.puntoDeVenta}
                  onChange={(e) => setSettings({...settings, puntoDeVenta: parseInt(e.target.value) || 1})}
                />
              </div>
            </div>

            <button 
              onClick={saveSettings}
              disabled={isLoading}
              className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all mt-4"
            >
              <Save className="w-4 h-4" />
              Guardar Configuración
            </button>
          </div>
        </div>

        {/* CERTIFICADOS DIGITALES */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xl shadow-zinc-200/20">
          <h2 className="text-lg font-black tracking-tight text-zinc-800 mb-6 flex items-center gap-2">
            <Key className="w-5 h-5 text-black" />
            Certificado Digital
          </h2>
          
          <div className="mb-6 p-4 rounded-xl border flex flex-col gap-2 bg-zinc-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-700">Clave Privada:</span>
              {settings.hasPrivateKey ? <span className="text-emerald-600 flex items-center gap-1 text-sm font-bold"><CheckCircle2 className="w-4 h-4"/> Generada</span> : <span className="text-amber-600 flex items-center gap-1 text-sm font-bold"><AlertTriangle className="w-4 h-4"/> Falta</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-700">Certificado ARCA (.crt):</span>
              {settings.hasCertificate ? <span className="text-emerald-600 flex items-center gap-1 text-sm font-bold"><CheckCircle2 className="w-4 h-4"/> Cargado</span> : <span className="text-amber-600 flex items-center gap-1 text-sm font-bold"><AlertTriangle className="w-4 h-4"/> Falta</span>}
            </div>
          </div>

          <div className="space-y-6">
            {/* Paso 1: CSR */}
            <div className="p-4 border border-zinc-200 rounded-xl">
              <h3 className="text-xs font-black uppercase text-zinc-500 mb-4">1. Generar Pedido (CSR)</h3>
              <div className="flex flex-col gap-2 mb-3">
                <input 
                  type="text" placeholder="CUIT Emisor" 
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm"
                  value={csrData.cuit} onChange={e => setCsrData({...csrData, cuit: e.target.value})}
                />
                <input 
                  type="text" placeholder="Alias (Ej: mipadelclub)" 
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm"
                  value={csrData.commonName} onChange={e => setCsrData({...csrData, commonName: e.target.value})}
                />
              </div>
              <button onClick={generateCsr} className="text-sm font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-900 w-full py-2 rounded-lg transition-colors">
                Descargar Archivo CSR
              </button>
            </div>

            {/* Paso 2: CRT */}
            <div className="p-4 border border-zinc-200 rounded-xl">
              <h3 className="text-xs font-black uppercase text-zinc-500 mb-4">2. Subir Certificado</h3>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  accept=".crt,.pem" 
                  className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-black hover:file:bg-zinc-200"
                  onChange={e => setCertFile(e.target.files ? e.target.files[0] : null)}
                />
                <button onClick={uploadCert} className="bg-black text-white p-2 rounded-lg hover:bg-zinc-800">
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* DIAGNOSTICO */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xl shadow-zinc-200/20">
        <h2 className="text-lg font-black tracking-tight text-zinc-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-black" />
          Test de Conexión
        </h2>
        <p className="text-sm text-zinc-600 mb-4">
          Realiza un "ping" a los servidores de Facturación Electrónica de ARCA usando tu certificado digital para comprobar que la comunicación y la clave sean válidas.
        </p>
        <div className="flex items-center gap-4">
          <button onClick={testConnection} className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors">
            Probar Conexión
          </button>
          {testResult && (
            <span className={`text-sm font-bold ${testResult.includes('Exitos') ? 'text-emerald-600' : 'text-red-600'}`}>
              {testResult}
            </span>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-zinc-100">
            <div className="flex items-center gap-3 mb-4">
              {modalState.isError ? (
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <h3 className="text-lg font-black text-zinc-900">{modalState.title}</h3>
            </div>
            <p className="text-zinc-600 text-sm font-medium mb-6 leading-relaxed">
              {modalState.message}
            </p>
            <div className="flex justify-end">
              <button 
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                className="px-6 py-2.5 bg-black text-white font-bold text-sm rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArcaSettings;

