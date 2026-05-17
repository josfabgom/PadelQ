import React, { useEffect } from 'react';
import { 
  DollarSign, Calendar as CalendarIcon, Users, Activity, TrendingUp, 
  Settings, CreditCard, QrCode, ShieldCheck, Box, ArrowRight
} from 'lucide-react';
import Header from '../components/Header';

const Dashboard = () => {
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
  }, [isAdmin, isMerchant, isStaff, isTeacher]);

  // Curated premium menu items, ordered strictly by user request:
  // Alquiler -> Caja -> Productos -> Clientes -> Cta Cte -> Actividades -> Membresias -> Reportes -> Validar -> Config
  const menuItems = [
    {
      href: '/bookings',
      icon: <CalendarIcon className="w-5 h-5" />,
      label: 'Alquiler de Canchas',
      desc: 'Gestión y reserva de canchas en tiempo real con calendario interactivo y cobros directos.',
      color: 'text-indigo-500 group-hover:text-white',
      bgHover: 'group-hover:bg-indigo-500',
      show: isAdmin || isStaff
    },
    {
      href: '/cash-management',
      icon: <DollarSign className="w-5 h-5" />,
      label: 'Control de Caja',
      desc: 'Apertura, cierre de caja y control minucioso de ingresos y egresos de efectivo.',
      color: 'text-emerald-500 group-hover:text-white',
      bgHover: 'group-hover:bg-emerald-500',
      show: isAdmin || isStaff
    },
    {
      href: '/products',
      icon: <Box className="w-5 h-5" />,
      label: 'Venta de Productos',
      desc: 'Control de inventario, stock y venta de bebidas, pelotas e insumos del bar.',
      color: 'text-sky-500 group-hover:text-white',
      bgHover: 'group-hover:bg-sky-500',
      show: isAdmin || isStaff
    },
    {
      href: '/users',
      icon: <Users className="w-5 h-5" />,
      label: 'Clientes',
      desc: 'Administración de socios, perfiles de contacto, saldos e historial del club.',
      color: 'text-violet-500 group-hover:text-white',
      bgHover: 'group-hover:bg-violet-500',
      show: isAdmin || isStaff
    },
    {
      href: '/ctacte',
      icon: <CreditCard className="w-5 h-5" />,
      label: 'Cuentas Corrientes',
      desc: 'Seguimiento de deudas, recargos automáticos, pagos y balances de clientes.',
      color: 'text-amber-500 group-hover:text-white',
      bgHover: 'group-hover:bg-amber-500',
      show: isAdmin || isStaff
    },
    {
      href: '/activities',
      icon: <Activity className="w-5 h-5" />,
      label: 'Clases y Actividades',
      desc: 'Programación de entrenamientos, torneos y agendas de los profesores.',
      color: 'text-rose-500 group-hover:text-white',
      bgHover: 'group-hover:bg-rose-500',
      show: isAdmin || isTeacher
    },
    {
      href: '/memberships',
      icon: <ShieldCheck className="w-5 h-5" />,
      label: 'Planes y Membresías',
      desc: 'Configuración de abonos mensuales, beneficios exclusivos y descuentos de socios.',
      color: 'text-blue-500 group-hover:text-white',
      bgHover: 'group-hover:bg-blue-500',
      show: isAdmin
    },
    {
      href: '/reports',
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Reportes y Finanzas',
      desc: 'Gráficos financieros, análisis de recaudación y exportación de Libro IVA para ARCA.',
      color: 'text-fuchsia-500 group-hover:text-white',
      bgHover: 'group-hover:bg-fuchsia-500',
      show: isAdmin
    },
    {
      href: '/validate',
      icon: <QrCode className="w-5 h-5" />,
      label: 'Validar Acceso QR',
      desc: 'Escaneo y validación instantánea de turnos, clases y credenciales del club.',
      color: 'text-zinc-500 group-hover:text-white',
      bgHover: 'group-hover:bg-zinc-800',
      show: isAdmin || isStaff || isMerchant
    },
    {
      href: '/settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'Configuración',
      desc: 'Definición de horarios de apertura, precios base de canchas y ajustes generales.',
      color: 'text-amber-600 group-hover:text-white',
      bgHover: 'group-hover:bg-amber-600',
      show: isAdmin
    }
  ];

  return (
    <div className="p-10 space-y-10 bg-[#fafafa] min-h-screen font-oak">
      <Header />
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-black tracking-tight mb-1 uppercase italic">Dashboard</h1>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Gestión Integral del Club</p>
        </div>
      </div>

      {/* Grid of Breathtaking, Sleeker and Smaller Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {menuItems.filter(item => item.show).map((item, idx) => (
          <a
            key={idx}
            href={item.href}
            className="group bg-white p-6 rounded-[28px] border border-black/5 hover:border-black/10 hover:shadow-[0_15px_35px_rgba(0,0,0,0.03)] transition-all duration-300 flex flex-col justify-between h-[230px] relative overflow-hidden"
          >
            {/* Top Row with Curated Curving Background accent */}
            <div className="space-y-4">
              <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center bg-zinc-50 border border-zinc-100/50 ${item.color} ${item.bgHover} transition-all duration-300 shadow-sm`}>
                {item.icon}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black italic uppercase text-black tracking-tight group-hover:translate-x-1 transition-transform duration-300">
                  {item.label}
                </h3>
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider leading-relaxed pr-2 line-clamp-2">
                  {item.desc}
                </p>
              </div>
            </div>

            {/* Bottom Row showing Access Action */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-50">
              <span className="text-[9px] font-black text-black uppercase tracking-[0.2em] group-hover:text-zinc-500 transition-colors">
                Ingresar al módulo
              </span>
              <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center group-hover:bg-black group-hover:text-white group-hover:border-black group-hover:translate-x-1 transition-all duration-300 shadow-sm">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
