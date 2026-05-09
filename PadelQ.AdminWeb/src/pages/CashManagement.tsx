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
    Printer,
    Trash2
} from 'lucide-react';
import Header from '../components/Header';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    totalCashSales?: number;
    totalTransferSales?: number;
    totalCardSales?: number;
    totalOtherSales?: number;
    totalCashIn?: number;
    totalCashOut?: number;
}

const CashManagement = () => {
    const [currentStatus, setCurrentStatus] = useState<any>(null);
    const [history, setHistory] = useState<CashClosure[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpening, setIsOpening] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState<'income' | 'outcome'>('income');

    // Form states
    const [initialCash, setInitialCash] = useState<number>(0);
    const [actualCash, setActualCash] = useState<number>(0);
    const [actualTotals, setActualTotals] = useState<{ [key: string]: number }>({});
    const [notes, setNotes] = useState('');
    const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
    const [adjustmentDescription, setAdjustmentDescription] = useState('');
    const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
    const [selectedMethodDetail, setSelectedMethodDetail] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const config = getAuthConfig();
    const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]').map((r: string) => r.toLowerCase());
    const isAdmin = roles.includes('admin');

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
            setError(null);
        } catch (err: any) {
            console.error("Error fetching cash data", err);
            setError(err.response?.data || "Error al cargar los datos de caja");
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

    const handleRegisterAdjustment = async () => {
        if (adjustmentAmount <= 0) return alert("El monto debe ser mayor a 0");
        if (!adjustmentDescription) return alert("Ingresa un concepto o descripción");

        try {
            await api.post('/api/cash-closures/adjustment', {
                amount: adjustmentAmount,
                description: adjustmentDescription,
                isIncome: adjustmentType === 'income',
                paymentMethodId: selectedMethodId
            }, config);
            setIsAdjusting(false);
            setAdjustmentAmount(0);
            setAdjustmentDescription('');
            setSelectedMethodId(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data || "Error al registrar movimiento");
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm("¿Estás seguro de que deseas anular este movimiento? Esta acción limpiará el registro de la caja.")) return;
        try {
            await api.delete(`/api/transaction/${id}`, config);
            fetchData();
        } catch (err: any) {
            alert("Error al anular movimiento: " + (err.response?.data || err.message));
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
        try {
            const doc = new jsPDF();
            let actualTotalsParsed = {};
            try {
                actualTotalsParsed = closure.actualTotals ? (typeof closure.actualTotals === 'string' ? JSON.parse(closure.actualTotals) : closure.actualTotals) : {};
            } catch (e) {
                console.error("Error parsing actualTotals", e);
            }

            // Header
            doc.setFillColor(0, 0, 0);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text("PadelQ", 20, 25);
            doc.setFontSize(12);
            doc.text("PLANILLA DE CIERRE DE CAJA", 190, 25, { align: "right" });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");

            let currentY = 50;
            doc.text(`ID Cierre: #${closure.id}`, 20, currentY);
            doc.text(`Fecha/Hora Reporte: ${new Date().toLocaleString()}`, 190, currentY, { align: "right" });
            currentY += 7;
            doc.text(`Apertura: ${new Date(closure.openingDate).toLocaleString()}`, 20, currentY);
            doc.text(`Cierre: ${closure.closingDate ? new Date(closure.closingDate).toLocaleString() : 'EN CURSO'}`, 190, currentY, { align: "right" });
            currentY += 7;
            doc.text(`Operador Responsable: ${closure.closedBy || closure.openedBy || 'Admin'}`, 20, currentY);

            // Control de Efectivo Section
            currentY += 15;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("1. CONTROL FÍSICO DE EFECTIVO", 20, currentY);
            currentY += 5;

            const expectedCash = closure.initialCash + (closure.totalCashSales || 0) + (closure.totalCashIn || 0) - (closure.totalCashOut || 0);
            const diffCash = (closure.actualCash || 0) - expectedCash;

            const cashRows = [
                ["Fondo Inicial de Apertura", formatARS(closure.initialCash)],
                ["(+) Ventas en Efectivo", formatARS(closure.totalCashSales || 0)],
                ["(+) Ingresos Manuales", formatARS(closure.totalCashIn || 0)],
                ["(-) Egresos Manuales", formatARS(closure.totalCashOut || 0)],
                ["(=) TOTAL EFECTIVO ESPERADO (Sistema)", formatARS(expectedCash)],
                ["(X) TOTAL EFECTIVO REAL CONTADO", formatARS(closure.actualCash || 0)],
                ["DIFERENCIA / SOBRANTE O FALTANTE", formatARS(diffCash)]
            ];

            autoTable(doc, {
                startY: currentY + 5,
                body: cashRows,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 5 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120 }, 1: { halign: 'right' } },
                didParseCell: (data: any) => {
                    if (data.row.index === 6 && data.section === 'body') {
                        if (diffCash < -1) data.cell.styles.textColor = [200, 0, 0];
                        if (diffCash > 1) data.cell.styles.textColor = [0, 150, 0];
                    }
                }
            });

            currentY = (doc as any).lastAutoTable?.finalY || (currentY + 80);
            currentY += 15;

            // Control de Otros Medios Section
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("2. CONTROL DE OTROS MEDIOS DE PAGO", 20, currentY);
            currentY += 5;

            const otherMethodsRows: any[] = [];
            const otherMethods = [...new Set(transactions.map(t => t.method).filter(m => !m.toLowerCase().includes('efectivo')))];

            otherMethods.forEach(method => {
                const expected = transactions.filter(t => t.method === method).reduce((s, t) => s + t.amount, 0);
                const actual = (actualTotalsParsed as any)[method] !== undefined ? (actualTotalsParsed as any)[method] : expected;
                otherMethodsRows.push([
                    method,
                    formatARS(expected),
                    formatARS(actual),
                    formatARS(actual - expected)
                ]);
            });

            autoTable(doc, {
                startY: currentY + 5,
                head: [['Medio de Pago', 'Esperado (Sistema)', 'Real Declarado', 'Diferencia']],
                body: otherMethodsRows.length > 0 ? otherMethodsRows : [['Sin movimientos en otros medios', '-', '-', '-']],
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40] },
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
            });

            currentY = (doc as any).lastAutoTable?.finalY || (currentY + 40);
            currentY += 20;

            // Signature Section
            if (currentY > 240) { doc.addPage(); currentY = 30; }

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);

            doc.line(20, currentY + 30, 80, currentY + 30);
            doc.text("Firma Operador de Caja", 50, currentY + 35, { align: "center" });
            doc.setFont("helvetica", "bold");
            doc.text(closure.closedBy || closure.openedBy || 'Admin', 50, currentY + 40, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.line(130, currentY + 30, 190, currentY + 30);
            doc.text("Firma Responsable Admin.", 160, currentY + 35, { align: "center" });

            if (closure.notes) {
                currentY += 60;
                if (currentY > 270) { doc.addPage(); currentY = 30; }
                doc.setFont("helvetica", "bold");
                doc.text("Observaciones del Cierre:", 20, currentY);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(9);
                doc.text(closure.notes, 20, currentY + 7, { maxWidth: 170 });
            }

            doc.save(`Cierre_Caja_${closure.id}_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
        } catch (error) {
            console.error("Critical error generating PDF", error);
            throw error; // Re-throw to be caught by handleCloseCash
        }
    };

    const handleCloseCash = async () => {
        if (!confirm("¿Estás seguro de que deseas realizar el cierre de caja? Esta acción no se puede deshacer.")) return;

        try {
            const res = await api.post('/api/cash-closures/close', {
                actualCash,
                notes,
                actualTotals: JSON.stringify(actualTotals)
            }, config);
            
            // Cerrar el modal inmediatamente después de la respuesta exitosa
            setIsClosing(false);

            // Auto generate PDF on close
            try {
                const closureId = res.data.id;
                const detailsRes = await api.get(`/api/cash-closures/${closureId}/details`, config);
                generatePDF(detailsRes.data.closure, detailsRes.data.transactions);
            } catch (pdfErr) {
                console.error("Error generating PDF", pdfErr);
                alert("La caja se cerró correctamente, pero hubo un error al generar el PDF automático. Puedes descargarlo desde el historial.");
            }

            // Limpiar estados
            setActualCash(0);
            setActualTotals({});
            setNotes('');
            
            fetchData();
        } catch (err: any) {
            console.error("Error closing cash", err);
            alert(err.response?.data || "Error al cerrar caja. Verifica que la conexión sea estable.");
        }
    };

    const formatARS = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
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

            {error && (
                <div className="p-6 bg-rose-50 border border-rose-100 rounded-[28px] flex items-center gap-4 text-rose-600 animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest">Error del Sistema</p>
                        <p className="text-xs font-bold">{error}</p>
                    </div>
                </div>
            )}

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
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                setAdjustmentType('income');
                                // Default to cash if available
                                const cashMethod = currentStatus.summary.find((s: any) => s.method.toLowerCase().includes('efectivo'));
                                setSelectedMethodId(cashMethod?.methodId || null);
                                setIsAdjusting(true);
                            }}
                            className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-3"
                        >
                            <TrendingUp className="w-5 h-5" /> Ingreso Manual
                        </button>
                        <button
                            onClick={() => {
                                setAdjustmentType('outcome');
                                // Default to cash if available
                                const cashMethod = currentStatus.summary.find((s: any) => s.method.toLowerCase().includes('efectivo'));
                                setSelectedMethodId(cashMethod?.methodId || null);
                                setIsAdjusting(true);
                            }}
                            className="px-8 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-rose-500/20 hover:bg-rose-600 transition-all flex items-center gap-3"
                        >
                            <ArrowRightLeft className="w-5 h-5" /> Egreso Manual
                        </button>
                        <button
                            onClick={() => {
                                // Solo incluimos explícitamente el método que contenga "Efectivo"
                                const cashMethod = currentStatus.summary.find((s: any) => s.method.toLowerCase().includes('efectivo'));
                                setActualCash(currentStatus.activeClosure.initialCash + (cashMethod?.total || 0));

                                // Initialize actualTotals with expected totals for all methods (except explicitly cash)
                                const initialTotals: { [key: string]: number } = {};
                                currentStatus.summary.forEach((s: any) => {
                                    initialTotals[s.method] = s.total;
                                });
                                setActualTotals(initialTotals);

                                setIsClosing(true);
                            }}
                            className="px-8 py-4 bg-black text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all flex items-center gap-3"
                        >
                            <Check className="w-5 h-5" /> Cerrar Caja
                        </button>
                    </div>
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

                    {/* Daily Journal Section */}
                    {currentStatus?.activeClosure && (
                        <div className="bg-white rounded-[40px] p-10 border border-black/5 shadow-[0_20px_60px_rgb(0,0,0,0.02)]">
                            <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white">
                                        <History className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-black uppercase italic">Libro Diario</h3>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Todos los movimientos del día</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {(() => {
                                    const allTransactions = currentStatus.summary
                                        .flatMap((s: any) => s.transactions.map((t: any) => ({ ...t, method: s.method, color: s.color })))
                                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                    if (allTransactions.length === 0) {
                                        return <p className="text-center py-10 text-zinc-300 text-[10px] font-black uppercase tracking-widest italic">No hay movimientos registrados</p>;
                                    }

                                    return allTransactions.map((t: any) => (
                                        <div key={t.id} className="p-5 bg-zinc-50 border border-zinc-100 rounded-[28px] flex items-center justify-between hover:bg-white hover:border-black/10 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                                                    {t.method.includes('Efectivo') ? <Wallet className="w-5 h-5" /> :
                                                     t.method.includes('Transferencia') ? <ArrowRightLeft className="w-5 h-5" /> :
                                                     <CreditCard className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] font-black text-black uppercase">{t.description || 'Sin concepto'}</p>
                                                        <span className="px-2 py-0.5 bg-zinc-100 rounded-md text-[7px] font-black text-zinc-400 uppercase tracking-tighter">{t.method}</span>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                                        {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs • Por: {t.processedBy || 'Sistema'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className={`text-lg font-black italic ${t.amount > 0 ? 'text-black' : 'text-rose-600'}`}>
                                                        {t.amount > 0 ? '+' : ''}{formatARS(t.amount)}
                                                    </span>
                                                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter mt-1">{t.userName}</p>
                                                </div>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => handleDeleteTransaction(t.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all ml-2"
                                                        title="Anular Movimiento"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
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
                            {/* Grand Total Summary */}
                            <div className="p-8 bg-black rounded-[32px] border border-black shadow-xl space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Total General Esperado</p>
                                        <h4 className="text-3xl font-black text-white italic tracking-tighter">
                                            {formatARS(currentStatus.activeClosure.initialCash + currentStatus.totalAmount)}
                                        </h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Total General Real</p>
                                        <h4 className="text-3xl font-black text-emerald-400 italic tracking-tighter">
                                            {formatARS(actualCash + Object.values(actualTotals).reduce((s, v) => s + (v || 0), 0))}
                                        </h4>
                                    </div>
                                </div>

                                {Math.abs((actualCash + Object.values(actualTotals).reduce((s, v) => s + (v || 0), 0)) - (currentStatus.activeClosure.initialCash + currentStatus.totalAmount)) > 1 && (
                                    <div className={`pt-4 border-t border-white/10 flex justify-between items-center ${(actualCash + Object.values(actualTotals).reduce((s, v) => s + (v || 0), 0)) > (currentStatus.activeClosure.initialCash + currentStatus.totalAmount)
                                            ? "text-emerald-400" : "text-rose-400"
                                        }`}>
                                        <span className="text-[10px] font-black uppercase tracking-widest italic">Diferencia Total en Caja</span>
                                        <span className="text-xl font-black">
                                            {formatARS((actualCash + Object.values(actualTotals).reduce((s, v) => s + (v || 0), 0)) - (currentStatus.activeClosure.initialCash + currentStatus.totalAmount))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-[28px] space-y-1">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Fondo Inicial</p>
                                    <h4 className="text-xl font-black text-black italic tracking-tighter">
                                        {formatARS(currentStatus.activeClosure.initialCash)}
                                    </h4>
                                </div>
                                <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-[28px] space-y-1">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Ventas Totales (Hoy)</p>
                                    <h4 className="text-xl font-black text-emerald-600 italic tracking-tighter">
                                        {formatARS(currentStatus.totalAmount)}
                                    </h4>
                                </div>
                            </div>

                            <div className="p-6 bg-rose-50 border border-rose-100 rounded-[32px] space-y-2">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Efectivo Total Esperado</p>
                                <h4 className="text-3xl font-black text-rose-600 italic tracking-tighter">
                                    {formatARS(currentStatus.activeClosure.initialCash + (currentStatus.summary.find((s: any) => s.method.includes('Efectivo'))?.total || 0))}
                                </h4>
                                <p className="text-[9px] font-bold text-rose-400 italic">Fondo inicial + Ventas en efectivo</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex justify-between">
                                    <span>Efectivo Real Contado ($)</span>
                                    {actualCash !== (currentStatus.activeClosure.initialCash + (currentStatus.summary.find((s: any) => s.method.includes('Efectivo'))?.total || 0)) && (
                                        <span className={actualCash > (currentStatus.activeClosure.initialCash + (currentStatus.summary.find((s: any) => s.method.includes('Efectivo'))?.total || 0)) ? "text-emerald-500" : "text-rose-500"}>
                                            Diferencia: {formatARS(actualCash - (currentStatus.activeClosure.initialCash + (currentStatus.summary.find((s: any) => s.method.includes('Efectivo'))?.total || 0)))}
                                        </span>
                                    )}
                                </label>
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

                            <div className="h-px bg-zinc-100 my-4"></div>
                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] italic">Otros Medios de Pago</h4>

                            {currentStatus?.summary.filter((s: any) => !s.method.includes('Efectivo')).map((s: any) => (
                                <div key={s.methodId} className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex justify-between">
                                        <span>Total Real {s.method} ($)</span>
                                        <span className="opacity-50 italic">Esperado: {formatARS(s.total)}</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2">
                                            {s.method.includes('Transferencia') ? <ArrowRightLeft className="w-5 h-5 text-zinc-400" /> : <CreditCard className="w-5 h-5 text-zinc-400" />}
                                        </div>
                                        <input
                                            type="number"
                                            value={actualTotals[s.method] === undefined ? s.total : actualTotals[s.method]}
                                            onChange={(e) => setActualTotals({ ...actualTotals, [s.method]: Number(e.target.value) })}
                                            className="w-full pl-16 pr-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[24px] focus:ring-4 focus:ring-black/5 outline-none text-lg font-black italic"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {actualTotals[s.method] !== undefined && actualTotals[s.method] !== s.total && (
                                        <p className={`text-[9px] font-bold text-right ${actualTotals[s.method] > s.total ? "text-emerald-500" : "text-rose-500"}`}>
                                            Diferencia: {formatARS(actualTotals[s.method] - s.total)}
                                        </p>
                                    )}
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

            {/* Manual Adjustment Modal */}
            {isAdjusting && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[70] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className={`p-8 ${adjustmentType === 'income' ? 'bg-emerald-500' : 'bg-rose-500'} text-white relative`}>
                            <button onClick={() => setIsAdjusting(false)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight">
                                {adjustmentType === 'income' ? 'Registrar Ingreso Manual' : 'Registrar Egreso Manual'}
                            </h2>
                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Movimiento directo de efectivo</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Medio de Pago</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {currentStatus?.summary.map((s: any) => (
                                        <button
                                            key={s.methodId}
                                            onClick={() => setSelectedMethodId(s.methodId)}
                                            className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                                selectedMethodId === s.methodId 
                                                ? 'bg-black text-white border-black shadow-lg' 
                                                : 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-zinc-300'
                                            }`}
                                        >
                                            {s.method}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Monto ($)</label>
                                <div className="relative">
                                    <DollarSign className={`absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 ${adjustmentType === 'income' ? 'text-emerald-500' : 'text-rose-500'}`} />
                                    <input
                                        type="number"
                                        value={adjustmentAmount}
                                        onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                                        className="w-full pl-16 pr-8 py-6 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none text-xl font-black italic"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Concepto / Motivo</label>
                                <textarea
                                    value={adjustmentDescription}
                                    onChange={(e) => setAdjustmentDescription(e.target.value)}
                                    className="w-full px-8 py-6 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm h-32 resize-none"
                                    placeholder={adjustmentType === 'income' ? "Ej: Dinero para cambio inicial..." : "Ej: Pago de factura de luz, retiro para cambio..."}
                                />
                            </div>
                            <button
                                onClick={handleRegisterAdjustment}
                                className={`w-full py-6 ${adjustmentType === 'income' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'} text-white rounded-[28px] font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all`}
                            >
                                Confirmar Movimiento
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
