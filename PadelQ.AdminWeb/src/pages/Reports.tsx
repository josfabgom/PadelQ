import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import Header from '../components/Header';
import ProductsMatrixByClosure from '../components/ProductsMatrixByClosure';
import { 
  BarChart as BarChartIcon, TrendingUp, Calendar, 
  ArrowLeft, Download, Filter, DollarSign, PieChart as PieChartIcon,
  X, Info, BarChart2, ChevronDown, RefreshCcw,
  Clock, Trophy, AlertTriangle, Layers
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReportItem {
  methodName: string;
  total: number;
  count: number;
  color: string;
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
};

interface KitchenSale {
  date: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  stock: number;
}

interface CourtUsageItem {
  courtId: number;
  courtName: string;
  isIndoor: boolean;
  surfaceType: string;
  pricePerHour: number;
  totalBookings: number;
  totalHours: number;
  totalRevenue: number;
  averageHourlyRevenue: number;
  sharePercentage: number;
}

interface CourtsUsageSummary {
  totalBookings: number;
  totalHours: number;
  totalRevenue: number;
  mostUsedCourt: string;
  mostUsedHours: number;
  leastUsedCourt: string;
  leastUsedHours: number;
}

const ReportsPage = () => {
  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]');
  const isAdmin = roles.includes('Admin');
  const isCocinero = roles.includes('Cocinero');
  const initialTab = (isCocinero && !isAdmin) ? 'kitchen' : 'dates';

  const [activeTab, setActiveTab] = useState<'dates' | 'courts' | 'products' | 'kitchen' | 'categories'>(initialTab);
  const [data, setData] = useState<ReportItem[]>([]);
  const [courtsUsageData, setCourtsUsageData] = useState<{
    summary: CourtsUsageSummary;
    courts: CourtUsageItem[];
  } | null>(null);
  const [kitchenData, setKitchenData] = useState<KitchenSale[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const getArgDateStr = (daysOffset = 0) =>
    new Date(Date.now() - 3 * 3600000 + daysOffset * 86400000).toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({
    start: getArgDateStr(-1),
    end: getArgDateStr(0)
  });

  // Daily Sales states
  const [isSalesReportOpen, setIsSalesReportOpen] = useState(false);
  const [salesReport, setSalesReport] = useState<any[]>([]);
  const [reportStartDate, setReportStartDate] = useState(getArgDateStr(0));
  const [reportEndDate, setReportEndDate] = useState(getArgDateStr(0));

  // Ranking states
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [rankingStartDate, setRankingStartDate] = useState(getArgDateStr(-30));
  const [rankingEndDate, setRankingEndDate] = useState(getArgDateStr(0));
  const [rankingSortColumn, setRankingSortColumn] = useState<string>('totalQuantity');
  const [rankingSortDirection, setRankingSortDirection] = useState<'asc' | 'desc'>('desc');
  const [loadingRanking, setLoadingRanking] = useState(false);

  const fetchReport = async () => {
    if (activeTab === 'courts') {
      try {
        setLoading(true);
        const res = await api.get(`/api/reports/courts-usage?startDate=${dateRange.start}&endDate=${dateRange.end}`, getAuthConfig());
        setCourtsUsageData(res.data);
      } catch (err) {
        console.error("Error fetching courts usage report", err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (activeTab === 'categories') {
      try {
        setLoading(true);
        const res = await api.get(`/api/reports/sales-by-category?startDate=${dateRange.start}&endDate=${dateRange.end}`, getAuthConfig());
        setCategoryData(res.data);
      } catch (err) {
        console.error("Error fetching categories report", err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (activeTab === 'kitchen') {
      try {
        setLoading(true);
        const res = await api.get(`/api/reports/kitchen-sales?startDate=${dateRange.start}&endDate=${dateRange.end}`, getAuthConfig());
        setKitchenData(res.data);
      } catch (err) {
        console.error("Error fetching kitchen report", err);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/api/transaction/report/payments-by-method?startDate=${dateRange.start}&endDate=${dateRange.end}`, getAuthConfig());
      setData(res.data);
    } catch (err) {
      console.error("Error fetching report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedCategory(null);
    fetchReport();
  }, [dateRange, activeTab]);

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/reports/product-sales-daily?startDate=${reportStartDate}&endDate=${reportEndDate}`, getAuthConfig());
      setSalesReport(res.data);
      setIsSalesReportOpen(true);
    } catch (err) {
      console.error("Error fetching daily sales report", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRankingData = async () => {
    try {
      setLoadingRanking(true);
      setIsRankingModalOpen(true);
      const res = await api.get(`/api/reports/products-ranking-by-day?startDate=${rankingStartDate}&endDate=${rankingEndDate}`, getAuthConfig());
      setRankingData(res.data);
    } catch (err) {
      console.error("Error fetching ranking data", err);
    } finally {
      setLoadingRanking(false);
    }
  };

  const generateSalesReportPDF = () => {
    const doc = new jsPDF();
    const title = 'Reporte de Ventas por Producto';
    doc.setFontSize(16);
    doc.text(title, 14, 20);

    const dateStr = `Desde: ${format(parseISO(reportStartDate), "d 'de' MMMM, yyyy", { locale: es })} Hasta: ${format(parseISO(reportEndDate), "d 'de' MMMM, yyyy", { locale: es })}`;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(dateStr, 14, 28);

    const tableColumn = ["Fecha", "Categoría", "Producto", "Cant.", "Recaudado"];
    const tableRows = salesReport.map(sale => [
      sale.date,
      sale.category || 'Sin Categoría',
      sale.productName,
      sale.totalQuantity.toString(),
      formatARS(sale.totalRevenue)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    const totalRevenue = salesReport.reduce((acc, curr) => acc + curr.totalRevenue, 0);
    const finalY = (doc as any).lastAutoTable?.finalY || 35;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Recaudado: ${formatARS(totalRevenue)}`, 14, finalY + 10);

    doc.save(`Reporte_Ventas_${reportStartDate}_a_${reportEndDate}.pdf`);
  };

  const handleSortRanking = (column: string) => {
    if (rankingSortColumn === column) {
      setRankingSortDirection(rankingSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setRankingSortColumn(column);
      setRankingSortDirection('desc');
    }
  };

  const getSortedRankingData = () => {
    return [...rankingData].sort((a, b) => {
      let aVal = a[rankingSortColumn];
      let bVal = b[rankingSortColumn];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return rankingSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return rankingSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const totalCollected = data.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="p-10 space-y-10 bg-[#fafafa] min-h-screen font-oak">
      <Header />

      <div className="flex justify-between items-end gap-6">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase italic">Reportes</h1>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
               {activeTab === 'dates' ? 'Métricas de Ingresos y Cobranzas' : activeTab === 'courts' ? 'Estadísticas de Uso y Rentabilidad de Canchas' : activeTab === 'products' ? 'Matriz de Productos por Caja' : activeTab === 'categories' ? 'Ventas por Categoría' : 'Ventas Cocina'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex gap-4">
            <button 
              onClick={fetchSalesReport}
              className="flex items-center gap-3 px-6 py-4 bg-white border border-black/5 text-black rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
            >
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Ventas Diarias
            </button>
            <button 
              onClick={fetchRankingData}
              className="flex items-center gap-3 px-6 py-4 bg-white border border-black/5 text-black rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
            >
              <BarChartIcon className="w-5 h-5 text-purple-500" />
              Ranking Semanal
            </button>
          </div>

          <div className="flex gap-2 bg-white p-2 rounded-[28px] border border-black/5 shadow-sm overflow-x-auto">
             {isAdmin && (
             <>
               <button 
                 onClick={() => setActiveTab('dates')}
                 className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'dates' ? 'bg-black text-white' : 'text-zinc-400 hover:text-black hover:bg-zinc-50'}`}
               >
                 Por Fechas
               </button>
               <button 
                 onClick={() => setActiveTab('courts')}
                 className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'courts' ? 'bg-black text-white' : 'text-zinc-400 hover:text-black hover:bg-zinc-50'}`}
               >
                 Uso de Canchas
               </button>
               <button 
                 onClick={() => setActiveTab('products')}
                 className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'products' ? 'bg-black text-white' : 'text-zinc-400 hover:text-black hover:bg-zinc-50'}`}
               >
                 Por Caja - Productos
               </button>
             </>
           )}
           {(isAdmin || isCocinero) && (
             <button 
               onClick={() => setActiveTab('kitchen')}
               className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'kitchen' ? 'bg-black text-white' : 'text-zinc-400 hover:text-black hover:bg-zinc-50'}`}
             >
               Ventas Cocina
             </button>
           )}
           {isAdmin && (
             <button 
               onClick={() => setActiveTab('categories')}
               className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'categories' ? 'bg-black text-white' : 'text-zinc-400 hover:text-black hover:bg-zinc-50'}`}
             >
               Por Categorías
             </button>
           )}
        </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-4">
        {/* Quick Presets */}
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-black/5 shadow-sm">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(now.getDate() - 90);
              setDateRange({
                start: start.toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
              });
            }}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-black hover:text-white transition-all"
          >
            Últimos 3 Meses
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(now.getDate() - 30);
              setDateRange({
                start: start.toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
              });
            }}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-black hover:text-white transition-all"
          >
            Últimos 30 Días
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(now.getDate() - 7);
              setDateRange({
                start: start.toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
              });
            }}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-black hover:text-white transition-all"
          >
            Últimos 7 Días
          </button>
        </div>

        <div className="flex gap-4 items-center bg-white p-4 rounded-[28px] border border-black/5 shadow-sm">
           <div className="flex items-center gap-3 px-4 border-r border-zinc-100">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <input 
                type="date" 
                className="text-xs font-black uppercase tracking-widest outline-none bg-transparent"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
           </div>
           <div className="flex items-center gap-3 px-4">
              <input 
                type="date" 
                className="text-xs font-black uppercase tracking-widest outline-none bg-transparent"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
           </div>
           <button 
             onClick={() => {
                if (activeTab === 'dates') fetchReport();
                // for other tabs, it re-fetches via useEffect on dateRange
             }}
             className="p-3 bg-black text-white rounded-2xl hover:scale-105 transition-all"
           >
             <Filter className="w-4 h-4" />
           </button>
        </div>
      </div>

      {activeTab === 'dates' ? (
        <div className="space-y-10">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-black p-10 rounded-[40px] shadow-2xl relative overflow-hidden group col-span-1">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[120%] bg-white/5 blur-[100px] rounded-full"></div>
            <div className="relative z-10">
               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                 <DollarSign className="w-6 h-6 text-white" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">Total Recaudado</p>
               <h3 className="text-4xl font-black text-white italic">${totalCollected.toLocaleString()}</h3>
               <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Rango seleccionado</span>
               </div>
            </div>
         </div>

         <div className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm col-span-2">
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-xl font-black text-black uppercase italic tracking-tight">Distribución por Método</h3>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Comparativa de ingresos por canal</p>
               </div>
               <button className="p-4 bg-zinc-50 hover:bg-black hover:text-white rounded-2xl transition-all border border-zinc-100">
                  <Download className="w-4 h-4" />
               </button>
            </div>

            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis 
                      dataKey="methodName" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 900, fill: '#A1A1AA'}}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 900, fill: '#A1A1AA'}}
                    />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontStyle: 'italic', fontWeight: 900}}
                    />
                    <Bar dataKey="total" radius={[8, 8, 8, 8]} barSize={40}>
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || '#000000'} />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm">
            <h3 className="text-xl font-black text-black uppercase italic tracking-tight mb-8">Volumen de Transacciones</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={10}
                    dataKey="count"
                    nameKey="methodName"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#000000'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-zinc-50">
               <h3 className="text-xl font-black text-black uppercase italic tracking-tight">Desglose Detallado</h3>
               <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Valores brutos por canal de cobro</p>
            </div>
            <div className="divide-y divide-zinc-50">
               {data.map((item, idx) => (
                  <div key={idx} className="p-8 flex items-center justify-between group hover:bg-zinc-50 transition-all">
                     <div className="flex items-center gap-6">
                        <div className="w-4 h-12 rounded-full" style={{ backgroundColor: item.color || '#000000' }}></div>
                        <div>
                           <p className="text-sm font-black text-black uppercase italic tracking-tight">{item.methodName}</p>
                           <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.count} pagos registrados</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-lg font-black text-black italic">${item.total.toLocaleString()}</p>
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                           {((item.total / totalCollected) * 100).toFixed(1)}% del total
                        </p>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
      </div>
      ) : activeTab === 'courts' ? (
        <div className="space-y-10">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-black p-8 rounded-[36px] shadow-2xl relative overflow-hidden text-white flex flex-col justify-between">
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[120%] bg-purple-500/10 blur-[80px] rounded-full"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Clock className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 mb-2">Total Horas Reservadas</p>
                <h3 className="text-4xl font-black italic">{courtsUsageData?.summary.totalHours || 0} hrs</h3>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-bold text-white/60">
                <span>{courtsUsageData?.summary.totalBookings || 0} turnos registrados</span>
              </div>
            </div>

            <div className="bg-black p-8 rounded-[36px] shadow-2xl relative overflow-hidden text-white flex flex-col justify-between">
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[120%] bg-emerald-500/10 blur-[80px] rounded-full"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 mb-2">Recaudación Canchas</p>
                <h3 className="text-4xl font-black italic text-emerald-400">{formatARS(courtsUsageData?.summary.totalRevenue || 0)}</h3>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-bold text-white/60">
                <span>Ingresos por alquiler</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[36px] border border-black/5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                  <Trophy className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">Cancha Más Utilizada</p>
                <h3 className="text-xl font-black text-black uppercase italic tracking-tight line-clamp-2">
                  {courtsUsageData?.summary.mostUsedCourt || '-'}
                </h3>
              </div>
              <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
                  {courtsUsageData?.summary.mostUsedHours || 0} hrs jugadas
                </span>
                <span className="text-xs font-bold text-zinc-400">Mayor demanda</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[36px] border border-black/5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">Cancha Menos Utilizada</p>
                <h3 className="text-xl font-black text-black uppercase italic tracking-tight line-clamp-2">
                  {courtsUsageData?.summary.leastUsedCourt || '-'}
                </h3>
              </div>
              <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl">
                  {courtsUsageData?.summary.leastUsedHours || 0} hrs jugadas
                </span>
                <span className="text-xs font-bold text-zinc-400">Menor demanda</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-black uppercase italic tracking-tight">Horas de Uso por Cancha</h3>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Tiempo total ocupado en el período</p>
                </div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courtsUsageData?.courts || []} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis 
                      dataKey="courtName" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 9, fontWeight: 900, fill: '#71717A'}}
                      interval={0}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 700, fill: '#A1A1AA'}}
                      unit="h"
                    />
                    <Tooltip 
                      formatter={(val: any) => [`${val} horas`, 'Uso']}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="totalHours" fill="#8B5CF6" radius={[10, 10, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[40px] border border-black/5 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-black uppercase italic tracking-tight">Recaudación por Cancha ($)</h3>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Ingresos brutos por alquileres</p>
                </div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courtsUsageData?.courts || []} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis 
                      dataKey="courtName" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 9, fontWeight: 900, fill: '#71717A'}}
                      interval={0}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 700, fill: '#A1A1AA'}}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip 
                      formatter={(val: any) => [formatARS(val), 'Recaudación']}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="totalRevenue" fill="#10B981" radius={[10, 10, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden p-10">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-black uppercase italic tracking-tight">Detalle Comparativo de Rendimiento</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Ranking de ocupación, horas jugadas y rendimiento financiero</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    <th className="py-4 pl-4">#</th>
                    <th className="py-4">Cancha</th>
                    <th className="py-4 text-center">Tipo / Superficie</th>
                    <th className="py-4 text-center">Turnos</th>
                    <th className="py-4 text-center">Tiempo Jugado</th>
                    <th className="py-4 text-right">Recaudado</th>
                    <th className="py-4 text-right">Promedio / Hora</th>
                    <th className="py-4 px-6 text-center">Participación (% del total)</th>
                    <th className="py-4 pr-4 text-center">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {courtsUsageData?.courts && courtsUsageData.courts.length > 0 ? (
                    courtsUsageData.courts.map((court, idx) => {
                      const isTop = idx === 0 && court.totalHours > 0;
                      const isZero = court.totalHours === 0;

                      return (
                        <tr key={court.courtId} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="py-5 pl-4 font-black text-sm text-zinc-400">
                            #{idx + 1}
                          </td>
                          <td className="py-5">
                            <div>
                              <p className="font-black text-black uppercase text-sm">{court.courtName}</p>
                              <p className="text-[10px] font-bold text-zinc-400">Tarifa base: ${court.pricePerHour}/h</p>
                            </div>
                          </td>
                          <td className="py-5 text-center">
                            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-zinc-100 text-zinc-600">
                              {court.surfaceType} • {court.isIndoor ? 'Indoor' : 'Outdoor'}
                            </span>
                          </td>
                          <td className="py-5 text-center font-black text-black text-sm">
                            {court.totalBookings}
                          </td>
                          <td className="py-5 text-center">
                            <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-purple-50 text-purple-700">
                              {court.totalHours} hrs
                            </span>
                          </td>
                          <td className="py-5 text-right font-black text-emerald-600 italic text-base">
                            {formatARS(court.totalRevenue)}
                          </td>
                          <td className="py-5 text-right font-bold text-zinc-600 text-sm">
                            {formatARS(court.averageHourlyRevenue)}
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-3 justify-center min-w-[140px]">
                              <div className="flex-1 bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${isTop ? 'bg-purple-600' : isZero ? 'bg-zinc-300' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.max(court.sharePercentage, 3)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-black text-zinc-700 w-12 text-right">
                                {court.sharePercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-5 pr-4 text-center">
                            {isTop ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800">
                                <Trophy className="w-3 h-3" /> Alta Demanda
                              </span>
                            ) : isZero ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-400">
                                Sin Uso
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700">
                                Demanda Media
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">
                        No hay canchas registradas o no se encontraron datos en el período seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'products' ? (
        <ProductsMatrixByClosure dateRange={dateRange} />
      ) : activeTab === 'categories' ? (
        <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden p-10">
           {selectedCategory ? (
             <>
               <div className="flex items-center gap-4 mb-8">
                 <button 
                   onClick={() => setSelectedCategory(null)}
                   className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors"
                 >
                   <ArrowLeft className="w-5 h-5 text-black" />
                 </button>
                 <h3 className="text-2xl font-black text-black uppercase italic tracking-tight">Detalle de Categoría: {selectedCategory}</h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-zinc-100">
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fecha</th>
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Producto</th>
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Cant. Vendida</th>
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Stock Actual</th>
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Precio Unit.</th>
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Total</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-50">
                     {categoryData.find(c => c.category === selectedCategory)?.details?.map((sale: any, i: number) => (
                       <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                         <td className="py-4 text-sm font-bold text-black">{sale.date}</td>
                         <td className="py-4 text-sm font-bold text-black">{sale.productName}</td>
                         <td className="py-4 text-sm font-bold text-zinc-500 text-center">{sale.quantity}</td>
                         <td className="py-4 text-sm font-bold text-zinc-500 text-center">{sale.stock}</td>
                         <td className="py-4 text-sm font-bold text-zinc-500 text-right">{formatARS(sale.unitPrice)}</td>
                         <td className="py-4 text-sm font-black text-black italic text-right">{formatARS(sale.total)}</td>
                       </tr>
                     ))}
                     {(!categoryData.find(c => c.category === selectedCategory)?.details || categoryData.find(c => c.category === selectedCategory)?.details?.length === 0) && (
                       <tr>
                         <td colSpan={6} className="py-8 text-center text-sm font-bold text-zinc-400">No hay detalles disponibles.</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </>
           ) : (
             <>
               <h3 className="text-2xl font-black text-black uppercase italic tracking-tight mb-8">Ventas por Categoría</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-zinc-100">
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Categoría</th>
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Cant. Vendida</th>
                       <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Total Ingresos</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-50">
                     {categoryData.map((cat, i) => (
                       <tr 
                         key={i} 
                         onClick={() => setSelectedCategory(cat.category)}
                         className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                       >
                         <td className="py-4 text-sm font-bold text-black uppercase group-hover:text-emerald-600 transition-colors">{cat.category}</td>
                         <td className="py-4 text-sm font-bold text-black text-center group-hover:text-emerald-600 transition-colors">{cat.totalQuantity}</td>
                         <td className="py-4 text-sm font-black text-emerald-500 text-right">{formatARS(cat.totalRevenue)}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </>
           )}
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden p-10">
           <h3 className="text-2xl font-black text-black uppercase italic tracking-tight mb-8">Ventas de Cocina</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-zinc-100">
                   <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fecha</th>
                   <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Producto</th>
                   <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Cant. Vendida</th>
                   <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Stock Actual</th>
                   <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Precio Unit.</th>
                   <th className="py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Total</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-zinc-50">
                 {kitchenData.map((sale, i) => (
                   <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                     <td className="py-4 text-sm font-bold text-black">{sale.date}</td>
                     <td className="py-4 text-sm font-bold text-black">{sale.productName}</td>
                     <td className="py-4 text-sm font-bold text-zinc-500 text-center">{sale.quantity}</td>
                     <td className="py-4 text-sm font-bold text-zinc-500 text-center">{sale.stock}</td>
                     <td className="py-4 text-sm font-bold text-zinc-500 text-right">${sale.unitPrice.toLocaleString()}</td>
                     <td className="py-4 text-sm font-black text-black italic text-right">${sale.total.toLocaleString()}</td>
                   </tr>
                 ))}
                 {kitchenData.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-8 text-center text-sm font-bold text-zinc-400">No hay ventas registradas en este período.</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
           {kitchenData.length > 0 && (
             <div className="mt-8 pt-8 border-t border-zinc-100 flex justify-end">
                <div className="text-right">
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Cocina</p>
                   <p className="text-3xl font-black text-black italic">${kitchenData.reduce((acc, sale) => acc + sale.total, 0).toLocaleString()}</p>
                </div>
             </div>
           )}
        </div>
      )}
{/* Daily Sales Report Modal */}
      {isSalesReportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[70] p-6 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl my-auto animate-in fade-in zoom-in duration-300 border border-black/5">
            <div className="p-8 bg-zinc-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight">Reporte de Ventas</h2>
                  <p className="text-blue-400/60 text-[9px] font-black uppercase tracking-widest">Lo que más sale hoy</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                  <span className="text-[10px] font-bold text-white/50 uppercase">Desde</span>
                  <input 
                    type="date" 
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    onBlur={fetchSalesReport}
                    className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                  <span className="text-[10px] font-bold text-white/50 uppercase">Hasta</span>
                  <input 
                    type="date" 
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    onBlur={fetchSalesReport}
                    className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
                <button onClick={() => setIsSalesReportOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-8">
              {salesReport.length > 0 ? (
                <div className="space-y-4">
                  {salesReport.length > 0 && salesReport[0].isRecentOnly && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                      <Info className="w-5 h-5 text-blue-500" />
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                        Sin ventas hoy. Mostrando acumulado de los últimos 7 días.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                    <div className="col-span-6">Producto</div>
                    <div className="col-span-2 text-center">Cant.</div>
                    <div className="col-span-2 text-right">Recaudado</div>
                    <div className="col-span-2 text-right">Utilidad</div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                    {salesReport.map((sale, i) => {
                      const utility = sale.totalRevenue - sale.totalCost;
                      return (
                        <div key={i} className="grid grid-cols-12 gap-4 items-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-blue-200 transition-colors">
                          <div className="col-span-6">
                            <p className="font-black italic text-sm">{sale.productName}</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{sale.category}</p>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black text-xs">
                              {sale.totalQuantity}
                            </span>
                          </div>
                          <div className="col-span-2 text-right font-bold text-zinc-600">
                            {formatARS(sale.totalRevenue)}
                          </div>
                          <div className="col-span-2 text-right font-black text-emerald-500 italic">
                            {formatARS(utility)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-zinc-100">
                    <button 
                      onClick={generateSalesReportPDF}
                      className="col-span-2 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20"
                    >
                      Descargar Reporte PDF
                    </button>
                    <div className="p-6 bg-zinc-900 rounded-3xl text-white border border-white/5">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Total Recaudado</p>
                      <p className="text-3xl font-black italic">{formatARS(salesReport.reduce((acc, s) => acc + s.totalRevenue, 0))}</p>
                    </div>
                    <div className="p-6 bg-emerald-500 rounded-3xl text-white">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Utilidad Estimada</p>
                      <p className="text-3xl font-black italic">{formatARS(salesReport.reduce((acc, s) => acc + (s.totalRevenue - s.totalCost), 0))}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <TrendingUp className="w-10 h-10 text-zinc-200" />
                  </div>
                  <p className="text-zinc-400 font-black uppercase tracking-[0.2em] text-xs">No hubo ventas registradas este día</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      

{/* Ranking Modal */}
      {isRankingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100] p-6">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-10 bg-black text-white relative shrink-0">
              <button onClick={() => setIsRankingModalOpen(false)} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl">
                    <BarChart2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tight">Ranking de Ventas por Día</h2>
                    <p className="text-white/60 font-bold uppercase tracking-widest text-xs mt-1">Mapa de calor de consumo</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mr-16">
                  <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                    <span className="text-[10px] font-bold text-white/50 uppercase">Desde</span>
                    <input 
                      type="date" 
                      value={rankingStartDate}
                      onChange={(e) => setRankingStartDate(e.target.value)}
                      onBlur={fetchRankingData}
                      className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                    <span className="text-[10px] font-bold text-white/50 uppercase">Hasta</span>
                    <input 
                      type="date" 
                      value={rankingEndDate}
                      onChange={(e) => setRankingEndDate(e.target.value)}
                      onBlur={fetchRankingData}
                      className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overflow-auto bg-zinc-50 flex-1">
              {loadingRanking ? (
                <div className="flex flex-col items-center justify-center py-20 h-full">
                  <RefreshCcw className="w-10 h-10 animate-spin text-zinc-300 mb-4" />
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Calculando ranking...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-black/5 whitespace-nowrap">Producto</th>
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'totalQuantity'].map((col) => {
                        const labels: Record<string, string> = {
                          monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom', totalQuantity: 'Total'
                        };
                        return (
                          <th 
                            key={col} 
                            onClick={() => handleSortRanking(col)}
                            className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-black/5 cursor-pointer hover:bg-zinc-50 transition-colors text-center group whitespace-nowrap"
                          >
                            <div className="flex items-center justify-center gap-1">
                              {labels[col]}
                              {rankingSortColumn === col ? (
                                rankingSortDirection === 'asc' ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {getSortedRankingData().length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">
                          No hay ventas registradas en el período seleccionado
                        </td>
                      </tr>
                    ) : (
                      getSortedRankingData().map((item, idx) => {
                      const maxDaily = Math.max(item.monday, item.tuesday, item.wednesday, item.thursday, item.friday, item.saturday, item.sunday);
                      
                      const getCellColor = (val: number) => {
                        if (val === 0) return 'text-zinc-300';
                        if (maxDaily > 0 && val === maxDaily) return 'bg-purple-100 text-purple-700 font-black';
                        if (maxDaily > 0 && val >= maxDaily * 0.7) return 'bg-purple-50 text-purple-600 font-bold';
                        return 'text-zinc-600';
                      };

                      return (
                        <tr key={item.productId} className="hover:bg-white transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-zinc-400 w-4 text-right">#{idx + 1}</span>
                              <div>
                                <p className="font-bold text-sm text-black uppercase">{item.productName}</p>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.category}</p>
                              </div>
                            </div>
                          </td>
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                            <td key={day} className="p-2 text-center align-middle">
                              <div className={`mx-auto w-10 h-10 flex items-center justify-center rounded-xl text-xs transition-colors ${getCellColor(item[day])}`}>
                                {item[day]}
                              </div>
                            </td>
                          ))}
                          <td className="p-4 text-center">
                            <div className="inline-flex items-center justify-center px-4 py-2 bg-black text-white rounded-xl text-xs font-black">
                              {item.totalQuantity}
                            </div>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      

    </div>
  );
};

export default ReportsPage;


