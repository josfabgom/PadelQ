import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import Header from '../components/Header';
import { 
  BarChart as BarChartIcon, TrendingUp, Calendar, 
  ArrowLeft, Download, Filter, DollarSign, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';

interface ReportItem {
  methodName: string;
  total: number;
  count: number;
  color: string;
}

const ReportsPage = () => {
  const [data, setData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetchReport = async () => {
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
    fetchReport();
  }, [dateRange]);

  const totalCollected = data.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="p-10 space-y-10 bg-[#fafafa] min-h-screen font-oak">
      <Header />

      <div className="flex justify-between items-end gap-6">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300">
            <ArrowLeft className="w-5 h-5 text-black" />
          </a>
          <div>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase italic">Reportes</h1>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Métricas de Ingresos y Cobranzas</p>
          </div>
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
             onClick={fetchReport}
             className="p-3 bg-black text-white rounded-2xl hover:scale-105 transition-all"
           >
             <Filter className="w-4 h-4" />
           </button>
        </div>
      </div>

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
  );
};

export default ReportsPage;
