import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
  DollarSign, Calendar as CalendarIcon, Users, Activity, TrendingUp, TrendingDown, 
  Layout, Settings, CreditCard, X, QrCode
} from 'lucide-react';
import Calendar from '../components/Calendar';

const Dashboard = () => {
  const [stats, setStats] = useState([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalBookings: 0, totalCourts: 0 });
  const [detailedBookings, setDetailedBookings] = useState([]);
  const [courts, setCourts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('padelq_token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        const [revRes, sumRes, detailRes, courtsRes] = await Promise.all([
          axios.get('http://localhost:5041/api/reports/revenue-stats', config),
          axios.get('http://localhost:5041/api/reports/summary', config),
          axios.get('http://localhost:5041/api/reports/bookings-detailed', config),
          axios.get('http://localhost:5041/api/courts', config)
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
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel de Control</h1>
          <p className="text-slate-500">RESUMEN GENERAL DEL CLUB</p>
        </div>
        <div className="flex gap-4">
          <a href="/courts" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Layout className="w-4 h-4" />
            Gestionar Canchas
          </a>
           <a href="/users" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Users className="w-4 h-4" />
            Gestionar Clientes
          </a>
          <a href="/activities" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Gestionar Actividades
          </a>
          <a href="/memberships" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Membresías
          </a>
          <a href="/validate" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            Validar Socio
          </a>
          <a href="/settings" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/80 transition-colors flex items-center gap-2 bg-slate-900 !text-white border-none shadow-lg shadow-slate-900/20">
            <Settings className="w-4 h-4" />
            Configuración
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<DollarSign/>} label="Ingresos Totales" value={`$${summary.totalRevenue}`} color="text-emerald-600" trend="+12.5%" />
        <StatCard icon={<CalendarIcon/>} label="Reservas Totales" value={summary.totalBookings} color="text-indigo-600" trend="+4.3%" />
        <StatCard icon={<Activity/>} label="Ocupación" value="78%" color="text-amber-600" trend="+2.1%" />
        <StatCard icon={<Users/>} label="Cli. Activos" value="142" color="text-rose-600" trend="+8.4%" />
      </div>

      <Calendar 
        bookings={detailedBookings} 
        courts={courts} 
        selectedDate={selectedDate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Gráfico de Ingresos</h2>
            <div className="flex gap-2 text-xs">
              <span className="px-3 py-1 bg-slate-100 rounded-full font-medium">Últimos 7 días</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Small Progress Card */}
        <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
          <TrendingUp className="absolute -right-12 -bottom-12 h-64 w-64 text-white/10 rotate-12" />
          <h3 className="text-lg font-medium text-white/80">Objetivo Mensual</h3>
          <p className="text-4xl font-bold mt-2">$2,500.00</p>
          <div className="h-2 bg-white/20 rounded-full mt-6">
            <div className="h-full bg-emerald-400 rounded-full" style={{width: '65%'}}></div>
          </div>
          <p className="mt-4 text-sm text-white/70">Vas por el 65% de tu meta. Sigue así.</p>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  trend: string;
}

const StatCard = ({ icon, label, value, color, trend }: StatCardProps) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
    <div>
      <div className={`p-3 rounded-xl bg-slate-50 ${color} mb-4 inline-block`}>
        {icon}
      </div>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
    </div>
    <div className={`text-xs font-bold ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'} bg-slate-50 px-2 py-1 rounded-lg`}>
      {trend}
    </div>
  </div>
);

export default Dashboard;
