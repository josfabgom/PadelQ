import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { ArrowLeft, Calendar, Search, CreditCard, ShieldCheck, AlertCircle, CheckCircle2, XCircle, RefreshCw, Download, User, DollarSign, AlertTriangle, FileText, X } from 'lucide-react';
import Header from '../components/Header';

interface LocalTransaction {
  id: number;
  amount: number;
  date: string;
  description: string;
  processedBy: string;
  userFullName: string;
  bookingId: string | null;
  spaceBookingId: string | null;
  paymentMethodName: string;
}

const MercadoPagoAudit: React.FC = () => {
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detalle del Pago Seleccionado
  const [selectedTx, setSelectedTx] = useState<LocalTransaction | null>(null);
  const [mpDetails, setMpDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  
  // Reembolso
  const [refunding, setRefunding] = useState(false);
  const [refundMessage, setRefundMessage] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [startDate, endDate]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/api/mercadopago/audit-transactions?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`,
        getAuthConfig()
      );
      setTransactions(res.data);
    } catch (error: any) {
      console.error('Error fetching audit transactions', error);
      alert('Error al cargar transacciones locales: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const extractPaymentId = (description: string | null): string | null => {
    if (!description) return null;
    // Busca patrones como "ID: 12345678" o "(ID: 12345678)"
    const match = description.match(/ID:\s*([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
  };

  const fetchMpDetails = async (tx: LocalTransaction) => {
    const mpId = extractPaymentId(tx.description);
    if (!mpId) {
      setMpDetails(null);
      setDetailsError('No se pudo encontrar un ID de pago de Mercado Pago en la descripción de esta transacción.');
      return;
    }

    setLoadingDetails(true);
    setDetailsError('');
    setMpDetails(null);
    setRefundMessage('');
    try {
      const res = await api.get(`/api/mercadopago/payment-details/${mpId}`, getAuthConfig());
      setMpDetails(res.data);
    } catch (error: any) {
      console.error('Error fetching Mercado Pago details', error);
      setDetailsError(error.response?.data?.message || error.response?.data || error.message || 'Error al obtener detalles en Mercado Pago.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenDetails = (tx: LocalTransaction) => {
    setSelectedTx(tx);
    fetchMpDetails(tx);
  };

  const handleCloseDetails = () => {
    setSelectedTx(null);
    setMpDetails(null);
    setDetailsError('');
    setRefundMessage('');
  };

  const handleRefund = async () => {
    if (!selectedTx || !mpDetails) return;
    const mpId = extractPaymentId(selectedTx.description);
    if (!mpId) return;

    if (!window.confirm(`¿Seguro que deseas reembolsar el pago de $${selectedTx.amount} (ID MP: ${mpId})? Esta acción devolverá el dinero al cliente en Mercado Pago.`)) {
      return;
    }

    setRefunding(true);
    setRefundMessage('');
    try {
      const res = await api.post(`/api/mercadopago/refund/${mpId}`, {}, getAuthConfig());
      setRefundMessage(res.data.Message || 'Reembolso procesado con éxito.');
      // Actualizar detalles del pago para ver el nuevo estado
      fetchMpDetails(selectedTx);
    } catch (error: any) {
      console.error('Error executing refund', error);
      setRefundMessage('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setRefunding(false);
    }
  };

  // Filtrado en el cliente para el término de búsqueda (ID Reserva, ID Pago, o Cliente)
  const filteredTransactions = transactions.filter(t => {
    const searchLower = searchTerm.toLowerCase();
    const mpId = extractPaymentId(t.description) || '';
    const bookingId = t.bookingId || '';
    const spaceBookingId = t.spaceBookingId || '';
    
    return (
      t.userFullName.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower) ||
      mpId.toLowerCase().includes(searchLower) ||
      bookingId.toLowerCase().includes(searchLower) ||
      spaceBookingId.toLowerCase().includes(searchLower)
    );
  });

  const groupedTransactions = React.useMemo(() => {
    const groups: Record<string, LocalTransaction & { groupedIds: number[], isGroup: boolean }> = {};
    const result: (LocalTransaction & { groupedIds?: number[], isGroup?: boolean })[] = [];

    filteredTransactions.forEach(t => {
      const mpId = extractPaymentId(t.description);
      if (mpId) {
        if (groups[mpId]) {
          groups[mpId].amount += t.amount;
          groups[mpId].groupedIds.push(t.id);
          if (!groups[mpId].description.includes(t.description)) {
              groups[mpId].description += ` | ${t.description}`;
          }
        } else {
          groups[mpId] = { ...t, groupedIds: [t.id], isGroup: true };
          result.push(groups[mpId]);
        }
      } else {
        result.push(t);
      }
    });
    // Ordenar de más reciente a más antigua
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions]);

  // Exportar los datos actuales a CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['ID Transacción Local', 'Fecha', 'Cliente', 'Monto Local', 'ID Mercado Pago', 'Descripción', 'Procesado Por'];
    const rows = filteredTransactions.map(t => [
      t.id,
      new Date(t.date).toLocaleString(),
      t.userFullName,
      t.amount,
      extractPaymentId(t.description) || 'N/A',
      t.description,
      t.processedBy
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_mercado_pago_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-black uppercase">Aprobado</span>;
      case 'refunded':
        return <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-black uppercase">Reembolsado</span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-xs font-black uppercase">Rechazado</span>;
      case 'in_process':
        return <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-black uppercase">En Proceso</span>;
      default:
        return <span className="px-3 py-1 bg-zinc-50 text-zinc-600 border border-zinc-150 rounded-full text-xs font-black uppercase">{status}</span>;
    }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
      <Header />
      
      {/* Header and Back Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Auditoría Mercado Pago</h1>
            <p className="text-slate-500 uppercase tracking-wider font-medium">Conciliación de pagos con QR y comisiones en tiempo real</p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredTransactions.length === 0}
          className="flex items-center gap-2 px-6 py-4 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 disabled:pointer-events-none rounded-2xl text-[11px] font-black uppercase tracking-widest border border-zinc-200 shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha Desde</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha Hasta</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Buscador</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, reserva o ID de pago..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cargando transacciones de la base de datos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                  <th className="py-5 px-6">ID Local</th>
                  <th className="py-5 px-6">Fecha/Hora</th>
                  <th className="py-5 px-6">Cliente</th>
                  <th className="py-5 px-6 text-right">Monto</th>
                  <th className="py-5 px-6">ID Pago MP</th>
                  <th className="py-5 px-6">Referencia</th>
                  <th className="py-5 px-6 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {groupedTransactions.map(t => {
                  const mpId = extractPaymentId(t.description);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-zinc-500">
                        {t.isGroup && t.groupedIds && t.groupedIds.length > 1 ? `Múltiples (${t.groupedIds.length})` : `#${t.id}`}
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        {new Date(t.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-900">{t.userFullName}</td>
                      <td className="py-4 px-6 text-right font-black text-slate-900 italic">
                        ${t.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6">
                        {mpId ? (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 font-mono text-xs font-bold rounded-lg border border-blue-100">
                            {mpId}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No encontrado</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500 font-medium truncate max-w-[200px]" title={t.description}>
                        {t.description}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {mpId ? (
                          <button
                            onClick={() => handleOpenDetails(t)}
                            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                          >
                            Ver Conciliación
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {groupedTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No se encontraron transacciones cobradas con Mercado Pago en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Side Modal / Overlay Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white h-screen shadow-2xl p-8 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right-16 duration-300">
            
            {/* Modal Header */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-xl font-bold text-slate-900">Detalles de Conciliación</h3>
                </div>
                <button
                  onClick={handleCloseDetails}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Local Details Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transacción Local PadelQ</h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                  <div>
                    <span className="text-slate-400 block uppercase text-[9px] font-black">Cliente</span>
                    <span className="text-slate-800 font-bold">{selectedTx.userFullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase text-[9px] font-black">Fecha Local</span>
                    <span className="text-slate-800 font-bold">{new Date(selectedTx.date).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase text-[9px] font-black">Monto Registrado</span>
                    <span className="text-slate-900 font-black text-sm">${selectedTx.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase text-[9px] font-black">Registrado Por</span>
                    <span className="text-slate-800 font-bold">{selectedTx.processedBy || 'Sistema'}</span>
                  </div>
                </div>
              </div>

              {/* Mercado Pago API Call Section */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Información de Mercado Pago (Tiempo Real)</h4>

                {loadingDetails && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consultando API de Mercado Pago...</p>
                  </div>
                )}

                {detailsError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">Error de Conexión MP</p>
                      <p className="text-xs mt-1 leading-relaxed font-semibold">{detailsError}</p>
                    </div>
                  </div>
                )}

                {mpDetails && (
                  <div className="space-y-6">
                    {/* Status Badge and Payment Method */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wide">ID Operación</span>
                        <span className="font-mono text-sm font-bold text-slate-800">{mpDetails.id}</span>
                      </div>
                      <div>
                        {getStatusBadge(mpDetails.status)}
                      </div>
                    </div>

                    {/* Financial Breakdown (Comisiones) */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Detalle Financiero</span>
                      
                      <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden text-sm">
                        <div className="p-4 flex justify-between bg-slate-50/50">
                          <span className="font-bold text-slate-500">Monto Bruto Cobrado</span>
                          <span className="font-black text-slate-800">${mpDetails.transaction_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="p-4 flex justify-between text-rose-600 bg-rose-50/10">
                          <span className="font-bold">Comisión de Mercado Pago</span>
                          <span className="font-black">- ${mpDetails.fee_details?.reduce((acc: number, curr: any) => acc + curr.amount, 0)?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}</span>
                        </div>

                        <div className="p-4 flex justify-between bg-emerald-50/10 text-emerald-700">
                          <span className="font-black">Neto Recibido en Cuenta</span>
                          <span className="font-black text-base">${mpDetails.transaction_details?.net_received_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payer Information */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Datos del Pagador</span>
                      <div className="p-4 border border-slate-100 rounded-2xl space-y-2 text-xs font-semibold text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Email Registrado:</span>
                          <span className="text-slate-800">{mpDetails.payer?.email || 'No provisto'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tipo de Pago:</span>
                          <span className="text-slate-800 uppercase">{mpDetails.payment_method_id} ({mpDetails.payment_type_id})</span>
                        </div>
                        {mpDetails.card?.last_four_digits && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Tarjeta Utilizada:</span>
                            <span className="text-slate-800 uppercase">{mpDetails.card?.cardholder?.name || 'Cliente'} - **** {mpDetails.card?.last_four_digits}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Cuotas:</span>
                          <span className="text-slate-800">{mpDetails.installments || 1} {mpDetails.installments === 1 ? 'cuota' : 'cuotas'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Diagnostics and Integrity Check */}
                    {Math.abs((mpDetails.transaction_amount || 0) - selectedTx.amount) > 0.01 && (
                      <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider">Inconsistencia Detectada</p>
                          <p className="text-xs mt-1 leading-relaxed">El monto registrado en el sistema local (${selectedTx.amount}) no coincide con el monto cobrado en Mercado Pago (${mpDetails.transaction_amount}). Por favor verifique el cobro manual.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate-100 pt-6 mt-8 space-y-4">
              {refundMessage && (
                <div className={`p-4 rounded-xl text-xs font-bold text-center ${refundMessage.startsWith('Error') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {refundMessage}
                </div>
              )}

              <div className="flex gap-4">
                {mpDetails && mpDetails.status === 'approved' && (
                  <button
                    onClick={handleRefund}
                    disabled={refunding}
                    className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {refunding ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Procesando Reembolso...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Reembolsar Pago
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleCloseDetails}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all text-center"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MercadoPagoAudit;
