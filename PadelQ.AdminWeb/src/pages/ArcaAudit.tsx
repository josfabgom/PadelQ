import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, FileText, CheckCircle2, AlertTriangle, Clock , ArrowLeft, ShieldCheck, X, Info } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5041/api/arcaaudit';

const ArcaAudit = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());

  const handleExport = () => {
    window.open(`${API_URL}/export-iva?year=${exportYear}&month=${exportMonth}`, '_blank');
    setShowExportModal(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_URL);
      setInvoices(res.data);
    } catch (err) {
      console.error('Error fetching invoices', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      await axios.post(`${API_URL}/${id}/retry`);
      fetchInvoices();
    } catch (err) {
      alert('Error al reintentar');
    }
  };

  const handleVerify = async (id: number) => {
    try {
      setVerifyingId(id);
      const res = await axios.get(`${API_URL}/${id}/verify`);
      setVerificationData(res.data);
    } catch (err: any) {
      alert('Error al verificar: ' + (err.response?.data?.message || err.message));
    } finally {
      setVerifyingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status || status === 'Pendiente') {
      return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><Clock className="w-3 h-3" /> Pendiente</span>;
    }
    if (status === 'Aprobado') {
      return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3" /> Aprobado</span>;
    }
    if (status === 'No Requiere') {
      return <span className="px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FileText className="w-3 h-3" /> No Facturable</span>;
    }
    // If it's an actual string error from AFIP
    return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3" /> {status.startsWith('Error') ? status : 'Error'}</span>;
  };

  const getInvoiceTypeName = (type: number | null) => {
    if (!type) return '-';
    const types: Record<number, string> = { 1: 'Factura A', 6: 'Factura B', 11: 'Factura C' };
    return types[type] || `Tipo ${type}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Auditoría AFIP</h1>
            <p className="text-sm text-zinc-500 mt-1">Monitoreo de comprobantes electrónicos y estados de conexión.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold flex items-center gap-2 transition-colors border border-emerald-200"
          >
            <FileText className="w-4 h-4" /> Libro IVA
          </button>
          <button 
            onClick={fetchInvoices}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xl shadow-zinc-200/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">Cliente</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">Monto</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">Comprobante</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">CAE</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">Estado AFIP</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-500 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-zinc-500">Cargando...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-zinc-500">No hay transacciones recientes.</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                      {new Date(inv.date).toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-900">
                      {inv.userName}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-zinc-900">
                      ${inv.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {inv.invoiceNumber ? (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm font-bold text-zinc-700">
                            {getInvoiceTypeName(inv.invoiceType)} {String(inv.invoiceNumber).padStart(8, '0')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-zinc-600">
                      {inv.cae || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(inv.arcaStatus)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(!inv.arcaStatus || inv.arcaStatus === 'Error' || inv.arcaStatus === 'Pendiente' || inv.arcaStatus === 'No Requiere') && (
                        <button 
                          onClick={() => handleRetry(inv.id)}
                          className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                          Facturar Manual
                        </button>
                      )}
                      {inv.arcaStatus === 'Aprobado' && (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleVerify(inv.id)}
                            disabled={verifyingId === inv.id}
                            className={`px-3 py-1.5 flex items-center gap-1 text-xs font-bold rounded-lg transition-colors ${verifyingId === inv.id ? 'bg-zinc-100 text-zinc-400' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            {verifyingId === inv.id ? 'Verificando...' : 'Verificar AFIP'}
                          </button>
                          <a 
                            href={`http://localhost:5041/api/arcaaudit/${inv.id}/print`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-zinc-100 text-zinc-800 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors inline-block"
                          >
                            Imprimir
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {verificationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">Verificación AFIP</h3>
                    <p className="text-xs font-bold text-zinc-500">Datos obtenidos de ARCA</p>
                  </div>
                </div>
                <button onClick={() => setVerificationData(null)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Comprobante Header */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-bold text-zinc-500 block">Comprobante</span>
                    <span className="text-lg font-black text-zinc-900">
                      {verificationData.afipCbteTipoStr} | {String(verificationData.afipPtoVta).padStart(5, '0')}-{String(verificationData.afipCbteNro).padStart(8, '0')}
                    </span>
                  </div>
                  {getStatusBadge(verificationData.afipStatus)}
                </div>

                {/* Cliente */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <span className="text-sm font-bold text-zinc-500 block mb-1">Datos del Receptor</span>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-zinc-900">{verificationData.afipClientName}</span>
                    <span className="text-xs font-bold text-zinc-500">{verificationData.afipDocTipo}: {verificationData.afipDocNro}</span>
                  </div>
                </div>

                {/* CAE y Fecha */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-50 rounded-2xl flex flex-col gap-1 border border-zinc-100">
                    <span className="text-sm font-bold text-zinc-500">CAE Oficial</span>
                    <span className="text-md font-mono font-black text-zinc-900 break-all">{verificationData.afipCae || '-'}</span>
                    <span className="text-[10px] font-bold text-zinc-400 mt-1">Vto: {verificationData.afipVtoCae}</span>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-2xl flex flex-col gap-1 border border-zinc-100">
                    <span className="text-sm font-bold text-zinc-500">Importe y Fecha</span>
                    <span className="text-lg font-black text-emerald-600">${verificationData.afipTotal?.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-zinc-400 mt-1">{verificationData.afipDate}</span>
                  </div>
                </div>
                
                {verificationData.isMocked && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 mt-4">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-blue-800 leading-relaxed">
                      {verificationData.message}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button 
                onClick={() => setVerificationData(null)}
                className="px-6 py-2.5 bg-zinc-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-all active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 tracking-tight">Libro IVA</h3>
                  <p className="text-sm font-bold text-zinc-500">Exportar ventas a CSV/Excel</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Mes</label>
                  <select 
                    value={exportMonth}
                    onChange={(e) => setExportMonth(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('es', { month: 'long' }).toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Año</label>
                  <input 
                    type="number" 
                    value={exportYear}
                    onChange={(e) => setExportYear(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-6 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExport}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-sm font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
              >
                <FileText className="w-4 h-4" /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArcaAudit;

