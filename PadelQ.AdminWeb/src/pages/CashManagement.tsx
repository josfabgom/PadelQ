import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
    DollarSign, 
    Calendar, 
    Users, 
    ArrowLeft, 
    Plus, 
    Check, 
    X, 
    TrendingUp, 
    Wallet, 
    History,
    CreditCard,
    ArrowRightLeft,
    Clock,
    User as UserIcon,
    AlertCircle,
    FileText,
    Printer
} from 'lucide-react';
import Header from '../components/Header';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CashClosure {
    id: number;
    openingDate: string;
    closingDate?: string;
    initialCash: number;
    expectedCash?: number;
    actualCash?: number;
    notes?: string;
    actualTotals?: string;
    openedBy: string;
    closedBy?: string;
    isOpen: boolean;
}

const CashManagement = () => {
    const [currentStatus, setCurrentStatus] = useState<any>(null);
    const [history, setHistory] = useState<CashClosure[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpening, setIsOpening] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    
    // Form states
    const [initialCash, setInitialCash] = useState<number>(0);
    const [actualCash, setActualCash] = useState<number>(0);
    const [actualTotals, setActualTotals] = useState<{[key: string]: number}>({});
    const [notes, setNotes] = useState('');
    const [selectedMethodDetail, setSelectedMethodDetail] = useState<any>(null);

    const config = getAuthConfig();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statusRes, historyRes] = await Promise.all([
                api.get('/api/cash-closures/current-status', config),
                api.get('/api/cash-closures/history', config)
            ]);
            setCurrentStatus(statusRes.data);
            setHistory(historyRes.data);
        } catch (err) {
            console.error("Error fetching cash data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCash = async () => {
        try {
            await api.post('/api/cash-closures/open', { initialCash, notes }, config);
            setIsOpening(false);
            setInitialCash(0);
            setNotes('');
            fetchData();
        } catch (err: any) {
            alert(err.response?.data || "Error al abrir caja");
        }
    };

    const handleDownloadPDF = async (closureId: number) => {
        try {
            const res = await api.get(`/api/cash-closures/${closureId}/details`, config);
            const { closure, transactions } = res.data;
            generatePDF(closure, transactions);
        } catch (err) {
            alert("Error al generar PDF");
        }
    };

    const generatePDF = (closure: CashClosure, transactions: any[]) => {
        const doc = new jsPDF() as any;
        
        // Header
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("PadelQ - Resumen de Cierre de Caja", 105, 20, { align: "center" });
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`ID Cierre: #${closure.id}`, 20, 35);
        doc.text(`Apertura: ${new Date(closure.openingDate).toLocaleString()}`, 20, 40);
        doc.text(`Cierre: ${closure.closingDate ? new Date(closure.closingDate).toLocaleString() : 'En curso'}`, 20, 45);
        doc.text(`Cajero/Vendedor: ${closure.closedBy || closure.openedBy}`, 20, 50);

        // Summary Totals
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Totales por Medio", 20, 65);
        
        const summaryData = transactions.reduce((acc: any, t: any) => {
            if (!acc[t.method]) acc[t.method] = { total: 0, count: 0 };
            acc[t.method].total += t.amount;
            acc[t.method].count++;
            return acc;
        }, {});

        const summaryRows = Object.keys(summaryData).map(method => [
            method,
            summaryData[method].count,
            formatARS(summaryData[method].total)
        ]);

        doc.autoTable({
            startY: 70,
            head: [['Medio de Pago', 'Movimientos', 'Subtotal']],
            body: summaryRows,
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0] }
        });

        // Transactions Detail
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Detalle de Operaciones y Consumos", 20, doc.lastAutoTable.finalY + 15);

        const transRows = transactions.map(t => [
            new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            t.userName,
            t.description,
            t.method,
            formatARS(t.amount)
        ]);

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 20,
            head: [['Hora', 'Cliente', 'Descripción / Consumos', 'Medio', 'Monto']],
            body: transRows,
            theme: 'striped',
            headStyles: { fillColor: [60, 60, 60] },
            styles: { fontSize: 8 }
        });

        // Final Totals
        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(12);
        doc.text(`Fondo Inicial: ${formatARS(closure.initialCash)}`, 140, finalY);
        doc.text(`Ingresos Totales: ${formatARS(transactions.reduce((s, t) => s + t.amount, 0))}`, 140, finalY + 7);
        doc.setFontSize(16);
        doc.text(`Efectivo Real en Caja: ${formatARS(closure.actualCash || 0)}`, 140, finalY + 17);

        if (closure.notes) {
            doc.setFontSize(10);
            doc.text("Observaciones:", 20, finalY + 30);
            doc.setFont("helvetica", "italic");
            doc.text(closure.notes, 20, finalY + 35, { maxWidth: 170 });
        }

        doc.save(`Cierre_Caja_${closure.id}_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    };

    const handleCloseCash = async () => {
        try {
            const res = await api.post('/api/cash-closures/close', { 
                actualCash, 
                notes,
                actualTotals: JSON.stringify(actualTotals)
            }, config);
            setIsClosing(false);
            setActualCash(0);
            setActualTotals({});
            setNotes('');
            
            // Auto generate PDF on close
            const closureId = res.data.id;
            const detailsRes = await api.get(`/api/cash-closures/${closureId}/details`, config);
            generatePDF(detailsRes.data.closure, detailsRes.data.transactions);
            
            fetchData();
        } catch (err: any) {
            alert(err.response?.data || "Error al cerrar caja");
        }
    };

    const formatARS = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(amount);
    };

    if (loading) return (
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
    );

    return (
        <div className="p-10 bg-[#fafafa] min-h-screen font-oak space-y-10">
            <Header />

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <a href="/dashboard" className="p-4 bg-white rounded-2xl border border-black/5 hover:bg-zinc-50 transition-all">
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </a>
                    <div>
                        <h1 className="text-4xl font-black text-black tracking-tight uppercase italic">Gestión de Caja</h1>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Cierre diario y control de ingresos</p>
                    </div>
                </div>

                {!currentStatus?.activeClosure ? (
                    <button 
                        onClick={() => setIsOpening(true)}
                        className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-3"
                    >
                        <Plus className="w-5 h-5" /> Abrir Caja del Día
                    </button>
                ) : (
                    <button 
                        onClick={() => {
                            setActualCash(currentStatus.activeClosure.initialCash + (currentStatus.summary.find((s:any) => s.method.includes('Efectivo'))?.total || 0));
                            setIsClosing(true);
                        }}
                        className="px-8 py-4 bg-black text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all flex items-center gap-3"
                    >
                        <Check className="w-5 h-5" /> Realizar Cierre de Caja
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Current Status Card */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-[40px] p-10 border border-black/5 shadow-[0_20px_60px_rgb(0,0,0,0.02)] relative overflow-hidden">
                        {currentStatus?.activeClosure ? (
                            <>
                                <div className="absolute top-0 right-0 p-8">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-pulse">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Caja Abierta</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100">
                                        <Clock className="w-7 h-7 text-black" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Iniciada el</p>
                                        <h3 className="text-xl font-black text-black uppercase italic">
                                            {new Date(currentStatus.activeClosure.openingDate).toLocaleString()}
                                        </h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                    <div className="p-8 bg-zinc-50 rounded-[32px] border border-zinc-100">
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Fondo Inicial</p>
                                        <h4 className="text-3xl font-black text-black italic tracking-tighter">{formatARS(currentStatus.activeClosure.initialCash)}</h4>
                                    </div>
                                    <div className="p-8 bg-black rounded-[32px] border border-black shadow-xl">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Ingresos Totales (Hoy)</p>
                                        <h4 className="text-3xl font-black text-white italic tracking-tighter">{formatARS(currentStatus.totalAmount)}</h4>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-black text-black uppercase tracking-[0.3em] mb-6 italic border-b border-zinc-100 pb-4">Desglose por Medios de Pago</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {currentStatus.summary.map((s: any, idx: number) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => setSelectedMethodDetail(s)}
                                                className="p-6 bg-white border border-zinc-100 rounded-[28px] flex items-center justify-between hover:border-black cursor-pointer transition-all group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                                                        {s.method.includes('Efectivo') ? <Wallet className="w-5 h-5" /> : 
                                                         s.method.includes('Transferencia') ? <ArrowRightLeft className="w-5 h-5" /> : 
                                                         <CreditCard className="w-5 h-5" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{s.method}</p>
                                                        <p className="text-[10px] font-bold text-zinc-500">{s.count} Movimientos</p>
                                                    </div>
                                                </div>
                                                <span className="text-xl font-black italic text-black">{formatARS(s.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-24 h-24 bg-zinc-50 rounded-[32px] flex items-center justify-center border border-zinc-100 text-zinc-300">
                                    <AlertCircle className="w-12 h-12" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-black uppercase italic">Caja Cerrada</h3>
                                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-2">Abre una nueva sesión para empezar a registrar ventas</p>
                                </div>
                                <button 
                                    onClick={() => setIsOpening(true)}
                                    className="px-10 py-5 bg-black text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest hover:scale-105 transition-all shadow-2xl shadow-black/20"
                                >
                                    Abrir Caja Ahora
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* History Sidebar */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-[0_20px_60px_rgb(0,0,0,0.02)]">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
                                <History className="w-5 h-5 text-black" />
                            </div>
                            <h3 className="text-sm font-black text-black uppercase tracking-widest">Últimos Cierres</h3>
                        </div>

                        <div className="space-y-4">
                            {history.length > 0 ? history.map((c) => (
                                <div key={c.id} className="p-5 border border-zinc-50 rounded-[24px] hover:bg-zinc-50 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{new Date(c.openingDate).toLocaleDateString()}</p>
                                            <p className="text-[10px] font-bold text-black uppercase">{c.openedBy} {'->'} {c.closedBy || '???'}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${c.isOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}`}>
                                            {c.isOpen ? 'ABIERTA' : 'CERRADA'}
                                        </div>
                                    </div>
                                    {!c.isOpen && (
                                        <div className="flex justify-between items-center pt-3 border-t border-zinc-100">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Efectivo Final:</span>
                                                <span className="text-xs font-black text-black">{formatARS(c.actualCash || 0)}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleDownloadPDF(c.id)}
                                                className="p-3 bg-zinc-100 hover:bg-black hover:text-white rounded-xl transition-all flex items-center gap-2 group"
                                            >
                                                <FileText className="w-4 h-4" />
                                                <span className="text-[9px] font-black uppercase hidden group-hover:block">PDF</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <p className="text-center py-10 text-zinc-300 text-[10px] font-black uppercase tracking-widest italic">No hay historial disponible</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isOpening && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[70] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8 bg-black text-white relative">
                            <button onClick={() => setIsOpening(false)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight">Abrir Nueva Caja</h2>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Indica el fondo inicial en efectivo</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fondo Inicial ($)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                                    <input 
                                        type="number" 
                                        value={initialCash}
                                        onChange={(e) => setInitialCash(Number(e.target.value))}
                                        className="w-full pl-16 pr-8 py-6 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none text-xl font-black italic"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notas / Observaciones</label>
                                <textarea 
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-8 py-6 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm h-32 resize-none"
                                    placeholder="Ej: Cambio en billetes de 1000..."
                                />
                            </div>
                            <button 
                                onClick={handleOpenCash}
                                className="w-full py-6 bg-emerald-500 text-white rounded-[28px] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                            >
                                Confirmar Apertura
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isClosing && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[70] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/5">
                        <div className="p-8 bg-zinc-900 text-white relative">
                            <button onClick={() => setIsClosing(false)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight text-rose-400">Cierre de Caja</h2>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Verifica el efectivo físico disponible</p>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="p-6 bg-rose-50 border border-rose-100 rounded-[32px] space-y-2">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Efectivo Esperado (Teórico)</p>
                                <h4 className="text-3xl font-black text-rose-600 italic tracking-tighter">
                                    {formatARS(currentStatus.activeClosure.initialCash + (currentStatus.summary.find((s:any) => s.method.includes('Efectivo'))?.total || 0))}
                                </h4>
                                <p className="text-[9px] font-bold text-rose-400 italic">Fondo inicial + Ventas en efectivo</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Efectivo Real Contado ($)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-black" />
                                    <input 
                                        type="number" 
                                        value={actualCash}
                                        onChange={(e) => setActualCash(Number(e.target.value))}
                                        className="w-full pl-16 pr-8 py-6 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none text-xl font-black italic"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {currentStatus?.summary.filter((s:any) => !s.method.includes('Efectivo')).map((s: any) => (
                                <div key={s.methodId} className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                        Total Real {s.method} ($) - Esperado: {formatARS(s.total)}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2">
                                            {s.method.includes('Transferencia') ? <ArrowRightLeft className="w-5 h-5 text-zinc-400" /> : <CreditCard className="w-5 h-5 text-zinc-400" />}
                                        </div>
                                        <input 
                                            type="number" 
                                            value={actualTotals[s.method] || ''}
                                            onChange={(e) => setActualTotals({ ...actualTotals, [s.method]: Number(e.target.value) })}
                                            className="w-full pl-16 pr-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[24px] focus:ring-4 focus:ring-black/5 outline-none text-lg font-black italic"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            ))}

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notas de Cierre</label>
                                <textarea 
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-8 py-6 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm h-32 resize-none"
                                    placeholder="¿Hubo algún faltante o sobrante? Justifica aquí..."
                                />
                            </div>
                            <button 
                                onClick={handleCloseCash}
                                className="w-full py-6 bg-black text-white rounded-[28px] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all"
                            >
                                Confirmar y Cerrar Caja
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Method Details Modal */}
            {selectedMethodDetail && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[70] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/5">
                        <div className="p-8 bg-zinc-900 text-white relative">
                            <button onClick={() => setSelectedMethodDetail(null)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${selectedMethodDetail.color}20`, color: selectedMethodDetail.color }}>
                                    {selectedMethodDetail.method.includes('Efectivo') ? <Wallet className="w-6 h-6" /> : 
                                     selectedMethodDetail.method.includes('Transferencia') ? <ArrowRightLeft className="w-6 h-6" /> : 
                                     <CreditCard className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black italic uppercase tracking-tight">{selectedMethodDetail.method}</h2>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Detalle de movimientos ({selectedMethodDetail.count})</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                            {selectedMethodDetail.transactions.map((t: any) => (
                                <div key={t.id} className="p-5 bg-zinc-50 border border-zinc-100 rounded-[24px] flex items-center justify-between group hover:bg-white hover:border-black/10 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 text-zinc-300" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-black uppercase">{t.userName}</p>
                                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs • Por: {t.processedBy || 'Sistema'}</p>
                                            <p className="text-[9px] text-zinc-500 mt-1 italic">{t.description}</p>
                                        </div>
                                    </div>
                                    <span className="text-lg font-black italic text-black">{formatARS(t.amount)}</span>
                                </div>
                            ))}

                            {selectedMethodDetail.transactions.length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em]">No hay movimientos registrados</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Acumulado</span>
                            <span className="text-2xl font-black italic text-black">{formatARS(selectedMethodDetail.total)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashManagement;
