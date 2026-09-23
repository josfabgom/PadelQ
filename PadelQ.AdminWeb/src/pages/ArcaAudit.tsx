import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, FileText, CheckCircle2, AlertTriangle, Clock , ArrowLeft} from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5041/api/arcaaudit';

const ArcaAudit = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        <button 
          onClick={fetchInvoices}
          className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl font-bold flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
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
                        <a 
                          href={`http://localhost:5041/api/arcaaudit/${inv.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-zinc-100 text-zinc-800 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors inline-block"
                        >
                          Imprimir
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArcaAudit;

