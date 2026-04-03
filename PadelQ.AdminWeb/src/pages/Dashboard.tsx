import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
  DollarSign, Calendar as CalendarIcon, Users, Activity, TrendingUp, TrendingDown, 
  Layout, Settings, CreditCard, X, QrCode, LogOut, Plus, ShieldCheck
} from 'lucide-react';

import Calendar from '../components/Calendar';
import Header from '../components/Header';

const Dashboard = () => {
  const [stats, setStats] = useState([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalBookings: 0, totalCourts: 0 });
  const [detailedBookings, setDetailedBookings] = useState([]);
  const [courts, setCourts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const config = getAuthConfig();
        
        const [revRes, sumRes, detailRes, courtsRes] = await Promise.all([
          api.get('/api/reports/revenue-stats', config),
          api.get('/api/reports/summary', config),
          api.get('/api/reports/bookings-detailed', config),
          api.get('/api/courts', config)
        ]);
        
        setStats(revRes.data);
        setSummary(sumRes.data);
        setDetailedBookings(detailRes.data);
        setCourts(courtsRes.data);
      } catch (err) {
        console.error("Error al cargar dashboard", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-10 space-y-10 bg-[#fafafa] min-h-screen font-oak">
      <Header />
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-black tracking-tight mb-1 uppercase italic">Dashboard</h1>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Gestión Integral del Club</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <NavButton href="/courts" icon={<Layout className="w-4 h-4" />} label="Canchas" />
          <NavButton href="/users" icon={<Users className="w-4 h-4" />} label="Clientes" />
          <NavButton href="/ctacte" icon={<CreditCard className="w-4 h-4" />} label="Cta. Cte." />
          <NavButton href="/activities" icon={<Activity className="w-4 h-4" />} label="Actividades" />

          <NavButton href="/memberships" icon={<CreditCard className="w-4 h-4" />} label="Membresías" />
          <NavButton href="/payment-methods" icon={<ShieldCheck className="w-4 h-4" />} label="Pagos" />
          <NavButton href="/reports" icon={<TrendingUp className="w-4 h-4" />} label="Reportes" />
          <NavButton href="/validate" icon={<QrCode className="w-4 h-4" />} label="Validar" />


          <NavButton href="/settings" icon={<Settings className="w-4 h-4" />} label="Config" primary />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard icon={<DollarSign/>} label="Ingresos" value={`$${summary.totalRevenue.toLocaleString()}`} trend="+12%" />
        <StatCard icon={<CalendarIcon/>} label="Reservas" value={summary.totalBookings} trend="+4%" />
        <StatCard icon={<Activity/>} label="Ocupación" value="78%" trend="+2%" />
        <StatCard icon={<Users/>} label="Clientes" value="142" trend="+8%" />
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-[0_10px_40px_rgb(0,0,0,0.03)] border border-black/5">
        <div className="mb-8 flex justify-between items-center">
            <h2 className="text-xl font-black text-black uppercase tracking-tight italic">Calendario de Reservas</h2>
        </div>
        <Calendar 
            bookings={detailedBookings} 
            courts={courts} 
            selectedDate={selectedDate}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-[0_10px_40px_rgb(0,0,0,0.03)] border border-black/5">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black text-black uppercase tracking-tight italic">Flujo de Ingresos</h2>
            <div className="px-4 py-2 bg-zinc-50 rounded-full border border-zinc-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Últimos 7 días</span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 700}}
                />
                <Area type="monotone" dataKey="revenue" stroke="#000000" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Small Progress Card */}
        <div className="bg-black p-10 rounded-[40px] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-white/5 blur-[100px] rounded-full group-hover:bg-white/10 transition-all duration-700"></div>
          <TrendingUp className="absolute -right-8 -bottom-8 h-48 w-48 text-white/5 rotate-12" />
          
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">Meta Mensual</p>
          <h3 className="text-4xl font-black text-white italic tracking-tight">$2,500.00</h3>
          
          <div className="mt-12 space-y-4">
              <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Progreso 65%</span>
                  <span className="text-2xl font-black text-white italic">+$500.00</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full">
                <div className="h-full bg-white rounded-full shadow-[0_0_20px_white]" style={{width: '65%'}}></div>
              </div>
          </div>
          
          <p className="mt-8 text-[11px] font-medium text-white/50 leading-relaxed uppercase tracking-widest">
              Estás en camino a superar el objetivo comercial del mes.
          </p>
          
          <button className="mt-10 w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all">
              Ver Reporte Detallado
          </button>
        </div>
      </div>
    </div>
  );
};

const NavButton = ({ href, icon, label, primary = false }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) => (
  <a 
    href={href} 
    className={`px-5 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-3 shadow-sm border ${
      primary 
        ? 'bg-black text-white border-black hover:bg-zinc-800' 
        : 'bg-white text-black border-black/5 hover:border-black/20 hover:bg-zinc-50'
    }`}
  >
    {icon}
    {label}
  </a>
);

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
}

const StatCard = ({ icon, label, value, trend }: StatCardProps) => (
  <div className="bg-white p-8 rounded-[32px] shadow-[0_10px_40px_rgb(0,0,0,0.02)] border border-black/5 flex items-start justify-between group hover:border-black/20 transition-all duration-500">
    <div>
      <div className="p-4 rounded-[20px] bg-zinc-50 text-black mb-6 inline-block shadow-sm group-hover:bg-black group-hover:text-white transition-all duration-500">
        {icon}
      </div>
      <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <h3 className="text-3xl font-black text-black italic tracking-tighter">{value}</h3>
    </div>
    <div className="flex flex-col items-end">
        <div className="text-[10px] font-black text-black bg-zinc-100 px-3 py-1 rounded-full uppercase tracking-widest">
        {trend}
        </div>
    </div>
  </div>
);

export default Dashboard;
