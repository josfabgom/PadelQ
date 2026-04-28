import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
  DollarSign, Calendar as CalendarIcon, Users, Activity, TrendingUp, TrendingDown, 
  Layout, Settings, CreditCard, X, QrCode, LogOut, Plus, ShieldCheck, LayoutGrid, Box
} from 'lucide-react';

import Calendar from '../components/Calendar';
import Header from '../components/Header';

const Dashboard = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [summary, setSummary] = useState({ 
    totalRevenue: 0, 
    totalBookings: 0, 
    todayRevenue: 0, 
    todayBookings: 0, 
    monthlyRevenue: 0, 
    monthlyGoal: 0, 
    monthlyProgress: 0 
  });
  const [detailedBookings, setDetailedBookings] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]');
  const isAdmin = roles.includes('Admin');
  const isMerchant = roles.includes('Merchant');
  const isStaff = roles.includes('Staff');
  const isTeacher = roles.includes('Teacher');

  useEffect(() => {
    // If only merchant, redirect to validate immediately
    if (isMerchant && !isAdmin && !isStaff) {
       window.location.href = '/validate';
       return;
    }

    // If only teacher, redirect to activities immediately
    if (isTeacher && !isAdmin && !isStaff) {
        window.location.href = '/activities';
        return;
    }
    
    const fetchData = async () => {
      try {
        const config = getAuthConfig();
        
        const [revRes, sumRes, detailRes, courtsRes] = await Promise.all([
          api.get('/api/reports/revenue-stats', config),
          api.get('/api/reports/summary', config),
          api.get('/api/reports/bookings-detailed', config),
          api.get('/api/courts', config)
        ]);
        
        setStats(Array.isArray(revRes.data) ? revRes.data : []);
        setSummary(sumRes.data || { 
          todayRevenue: 0, 
          todayBookings: 0, 
          totalRevenue: 0, 
          monthlyRevenue: 0, 
          monthlyProgress: 0 
        });
        setDetailedBookings(Array.isArray(detailRes.data) ? detailRes.data : []);
        setCourts(Array.isArray(courtsRes.data) ? courtsRes.data : []);
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
          {(isAdmin || isStaff) && <NavButton href="/bookings" icon={<CalendarIcon className="w-4 h-4" />} label="Alquiler" primary />}
          {(isAdmin || isStaff) && <NavButton href="/users" icon={<Users className="w-4 h-4" />} label="Clientes" />}
          {(isAdmin || isStaff) && <NavButton href="/ctacte" icon={<CreditCard className="w-4 h-4" />} label="Cta. Cte." />}
          {(isAdmin || isTeacher) && <NavButton href="/activities" icon={<Activity className="w-4 h-4" />} label="Actividades" />}
          {isAdmin && <NavButton href="/memberships" icon={<CreditCard className="w-4 h-4" />} label="Membresías" />}
          {isAdmin && <NavButton href="/payment-methods" icon={<ShieldCheck className="w-4 h-4" />} label="Pagos" />}
          {isAdmin && <NavButton href="/reports" icon={<TrendingUp className="w-4 h-4" />} label="Reportes" />}
          {(isAdmin || isStaff || isMerchant) && <NavButton href="/validate" icon={<QrCode className="w-4 h-4" />} label="Validar" />}
          {(isAdmin || isStaff) && <NavButton href="/products" icon={<Box className="w-4 h-4" />} label="Productos" />}
          {(isAdmin || isStaff) && <NavButton href="/cash-management" icon={<DollarSign className="w-4 h-4" />} label="Caja" primary />}

          {isAdmin && <NavButton href="/settings" icon={<Settings className="w-4 h-4" />} label="Config" primary />}
        </div>
      </div>

       {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <StatCard icon={<DollarSign/>} label="Ingreso del día" value={new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(summary?.todayRevenue || 0)} trend="Hoy" />
        <StatCard icon={<CalendarIcon/>} label="Reservas efectivas" value={summary?.todayBookings || 0} trend="Hoy" />
      </div>

      {/* Bottom section removed as per request */}
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
