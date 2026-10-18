import React, { useState, useEffect, useMemo } from 'react';
import api, { getAuthConfig } from '../api/api';
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  CreditCard,
  Download,
  X,
  Info
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5041';

const CloverAudit: React.FC = () => {
  const getArgDateStr = (daysOffset = 0) =>
    new Date(Date.now() - 3 * 3600000 + daysOffset * 86400000).toISOString().split('T')[0];
  const todayStr = getArgDateStr(0);
  const sevenDaysAgo = getArgDateStr(-7);

  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(sevenDaysAgo);
  const [endDate, setEndDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verificationData, setVerificationData] = useState<any | null>(null);

  useEffect(() => {
    fetchAudits();
  }, [startDate, endDate, statusFilter]);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/api/clover/audit?startDate=${startDate}&endDate=${endDate}&status=${statusFilter}`,
        getAuthConfig()
      );
      setAudits(res.data || []);
    } catch (err) {
      console.error('Error cargando auditoría Clover:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number) => {
    try {
      setVerifyingId(id);
      const res = await api.get(`/api/clover/audit/${id}/verify`, getAuthConfig());
      setVerificationData(res.data);
      fetchAudits();
    } catch (err: any) {
      alert('Error al verificar en Clover: ' + (err.response?.data?.message || err.message));
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredAudits = useMemo(() => {
    if (!searchTerm.trim()) return audits;
    const q = searchTerm.toLowerCase();
    return audits.filter((a) => {
      return (
        (a.clientName || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.sourceModule || '').toLowerCase().includes(q) ||
        (a.externalPaymentId || '').toLowerCase().includes(q) ||
        (a.cloverPaymentId || '').toLowerCase().includes(q) ||
        (a.cardBrand || '').toLowerCase().includes(q) ||
        (a.cardLast4 || '').toLowerCase().includes(q) ||
        (a.authCode || '').toLowerCase().includes(q) ||
        (a.processedBy || '').toLowerCase().includes(q)
      );
    });
  }, [audits, searchTerm]);

  const stats = useMemo(() => {
    const approved = filteredAudits.filter((a) => a.status === 'APPROVED');
    const cancelled = filteredAudits.filter((a) => a.status === 'CANCELLED');
    const failedOrTimeout = filteredAudits.filter(
      (a) => a.status === 'ERROR' || a.status === 'TIMEOUT'
    );
    return {
      approvedCount: approved.length,
      approvedTotal: approved.reduce((sum, a) => sum + (Number(a.amount) || 0), 0),
      cancelledCount: cancelled.length,
      cancelledTotal: cancelled.reduce((sum, a) => sum + (Number(a.amount) || 0), 0),
      failedCount: failedOrTimeout.length
    };
  }, [filteredAudits]);

  const handleExportCsv = () => {
    if (filteredAudits.length === 0) return;

    const headers = [
      'ID',
      'Fecha',
      'Modulo',
      'Cliente',
      'Concepto',
      'Monto',
      'Estado Terminal',
      'Detalle Estado',
      'ID Pago Clover',
      'ID Externo POS',
      'Tarjeta',
      'Ultimos 4',
      'Cod. Autorizacion',
      'Comprobante AFIP',
      'CAE',
      'Operador'
    ];

    const rows = filteredAudits.map((a) => {
      const invStr = a.invoiceNumber
        ? `${String(a.puntoDeVenta || 3).padStart(5, '0')}-${String(a.invoiceNumber).padStart(8, '0')}`
        : '-';
      return [
        a.id,
        new Date(a.createdAt).toLocaleString('es-AR'),
        a.sourceModule || '',
        (a.clientName || '').replace(/"/g, '""'),
        (a.description || '').replace(/"/g, '""'),
        Number(a.amount || 0).toFixed(2),
        a.status,
        (a.statusDetail || '').replace(/"/g, '""'),
        a.cloverPaymentId || '-',
        a.externalPaymentId || '-',
        a.cardBrand || '-',
        a.cardLast4 || '-',
        a.authCode || '-',
        invStr,
        a.cae || '-',
        a.processedBy || '-'
      ];
    });

    const csv =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Auditoria_Clover_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTerminalStatusBadge = (status: string, detail?: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span
            title={detail || 'Pago aprobado en la terminal Clover'}
            className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1 w-max"
          >
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Aprobado en Terminal
          </span>
        );
      case 'CANCELLED':
        return (
          <span
            title={detail || 'Pago cancelado en la terminal física Clover'}
            className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"
          >
            <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> Cancelado en Terminal
          </span>
        );
      case 'PENDING':
        return (
          <span
            title={detail || 'Esperando pago en la terminal Clover'}
            className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1 w-max"
          >
            <Clock className="w-3.5 h-3.5 flex-shrink-0" /> En Curso (Terminal)
          </span>
        );
      case 'TIMEOUT':
        return (
          <span
            title={detail || 'Tiempo de espera agotado en la terminal'}
            className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold flex items-center gap-1 w-max"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Tiempo Agotado
          </span>
        );
      default:
        return (
          <span
            title={detail || status}
            className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold flex items-center gap-1 max-w-[200px]"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{detail || status}</span>
          </span>
        );
    }
  };

  const getInvoiceTypeName = (type: number | null) => {
    if (!type) return 'Fact.';
    const types: Record<number, string> = { 1: 'Fact. A', 6: 'Fact. B', 11: 'Fact. C' };
    return types[type] || `Tipo ${type}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-5">
          <a
            href="/dashboard"
            className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group"
          >
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">
              Auditoría Comprobantes Clover
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Seguimiento en tiempo real de cobros aprobados y cancelaciones en la terminal física Clover Flex.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold flex items-center gap-2 transition-colors border border-emerald-200 text-sm"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={fetchAudits}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl font-bold flex items-center gap-2 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 block">
              Cobros Aprobados en Terminal
            </span>
            <span className="text-2xl font-black text-zinc-900 mt-1 block">
              ${stats.approvedTotal.toLocaleString('es-AR')}
            </span>
            <span className="text-xs font-bold text-zinc-500 mt-0.5 block">
              {stats.approvedCount} operaciones aprobadas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-rose-600 block">
              Cancelados desde la Terminal
            </span>
            <span className="text-2xl font-black text-zinc-900 mt-1 block">
              {stats.cancelledCount} {stats.cancelledCount === 1 ? 'operación' : 'operaciones'}
            </span>
            <span className="text-xs font-bold text-zinc-500 mt-0.5 block">
              Monto cancelado: ${stats.cancelledTotal.toLocaleString('es-AR')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500 block">
              Expirados / Sin Respuesta
            </span>
            <span className="text-2xl font-black text-zinc-900 mt-1 block">
              {stats.failedCount}
            </span>
            <span className="text-xs font-bold text-zinc-500 mt-0.5 block">
              Intentos no completados en terminal
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-zinc-200/80 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-black uppercase text-zinc-500">Desde:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-black uppercase text-zinc-500">Hasta:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-black uppercase text-zinc-500">Estado:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800"
          >
            <option value="ALL">Todos los estados</option>
            <option value="APPROVED">Aprobados en Terminal</option>
            <option value="CANCELLED">Cancelados en Terminal</option>
            <option value="PENDING">En Curso</option>
            <option value="TIMEOUT">Tiempo Agotado</option>
            <option value="ERROR">Con Error</option>
          </select>
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, tarjeta, cupón Clover, concepto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xl shadow-zinc-200/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                  Fecha
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                  Origen / Cliente
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                  Monto
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                  Cupón Clover / Tarjeta
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                  Estado en Terminal
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                  Factura AFIP
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500 text-right">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500 font-bold">
                    Cargando registros de la terminal Clover...
                  </td>
                </tr>
              ) : filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500 font-bold">
                    No se encontraron operaciones Clover para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredAudits.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-4 text-xs font-bold text-zinc-900 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                          {item.sourceModule}
                        </span>
                        <span className="text-sm font-bold text-zinc-900">
                          {item.clientName || 'Consumidor Final'}
                        </span>
                        <span
                          title={item.description}
                          className="text-xs text-zinc-500 max-w-[240px] truncate"
                        >
                          {item.description}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-black text-zinc-900 whitespace-nowrap">
                      ${Number(item.amount || 0).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-zinc-800">
                          {item.cloverPaymentId || item.externalPaymentId}
                        </span>
                        {item.cardBrand || item.cardLast4 ? (
                          <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1 mt-0.5">
                            <CreditCard className="w-3 h-3 text-emerald-600" />
                            {item.cardBrand || 'Tarjeta'} {item.cardLast4 ? `•••• ${item.cardLast4}` : ''}
                            {item.authCode ? ` (Aut: ${item.authCode})` : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">
                            {item.status === 'CANCELLED' ? 'Sin cargo (cancelado)' : 'Terminal ' + (item.deviceId || 'Clover')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {getTerminalStatusBadge(item.status, item.statusDetail)}
                        {item.statusDetail && item.status === 'CANCELLED' && (
                          <span className="text-[11px] font-semibold text-rose-600">
                            {item.statusDetail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {item.invoiceNumber ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-800">
                            {getInvoiceTypeName(item.invoiceType)}{' '}
                            {String(item.puntoDeVenta || 3).padStart(5, '0')}-
                            {String(item.invoiceNumber).padStart(8, '0')}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-600">
                            CAE: {item.cae}
                          </span>
                        </div>
                      ) : item.status === 'CANCELLED' ? (
                        <span className="text-xs font-bold text-zinc-400">No facturado</span>
                      ) : (
                        <span className="text-xs text-zinc-400">{item.arcaStatus || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleVerify(item.id)}
                          disabled={verifyingId === item.id}
                          className={`px-3 py-1.5 flex items-center gap-1 text-xs font-bold rounded-lg transition-colors ${
                            verifyingId === item.id
                              ? 'bg-zinc-100 text-zinc-400'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {verifyingId === item.id ? 'Consultando...' : 'Verificar Clover'}
                        </button>
                        {item.transactionId && item.arcaStatus === 'Aprobado' && (
                          <a
                            href={`${API_BASE_URL}/api/arcaaudit/${item.transactionId}/print`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-zinc-100 text-zinc-800 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors inline-block"
                          >
                            Imprimir Factura
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Verificación en Vivo contra Clover */}
      {verificationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">
                      Auditoría Clover
                    </h3>
                    <p className="text-xs font-bold text-zinc-500">
                      Estado del comprobante en terminal y servidor
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setVerificationData(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-zinc-500 block">
                      ID Pago Clover / Referencia
                    </span>
                    <span className="text-sm font-mono font-black text-zinc-900">
                      {verificationData.cloverPaymentId !== '-'
                        ? verificationData.cloverPaymentId
                        : verificationData.externalPaymentId}
                    </span>
                  </div>
                  {getTerminalStatusBadge(verificationData.status, verificationData.statusDetail)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-xs font-bold text-zinc-500 block">Tarjeta</span>
                    <span className="text-sm font-black text-zinc-900 mt-1 block">
                      {verificationData.cardBrand} {verificationData.cardLast4 !== '-' ? `•••• ${verificationData.cardLast4}` : ''}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-400 mt-1 block">
                      Aut: {verificationData.authCode}
                    </span>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-xs font-bold text-zinc-500 block">Importe y Fecha</span>
                    <span className="text-lg font-black text-emerald-600 mt-0.5 block">
                      ${Number(verificationData.amount || 0).toLocaleString('es-AR')}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-400 mt-0.5 block">
                      {verificationData.date}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-2xl flex items-start gap-3 border ${
                    verificationData.status === 'CANCELLED'
                      ? 'bg-rose-50 border-rose-200'
                      : verificationData.foundInClover
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-blue-50 border-blue-100'
                  }`}
                >
                  {verificationData.status === 'CANCELLED' ? (
                    <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  ) : verificationData.foundInClover ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  )}
                  <p
                    className={`text-xs font-bold leading-relaxed ${
                      verificationData.status === 'CANCELLED'
                        ? 'text-rose-800'
                        : verificationData.foundInClover
                        ? 'text-emerald-800'
                        : 'text-blue-800'
                    }`}
                  >
                    {verificationData.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setVerificationData(null)}
                className="px-6 py-2.5 bg-zinc-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-all"
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

export default CloverAudit;
