import { LogOut, User as UserIcon } from 'lucide-react';
import { VERSION } from '../version';

const Header = () => {
  const userName = localStorage.getItem('padelq_user_name') || 'Administrador';
  const userEmail = localStorage.getItem('padelq_user_email') || '';

  const handleLogout = () => {
    localStorage.removeItem('padelq_token');
    localStorage.removeItem('padelq_user_name');
    localStorage.removeItem('padelq_user_email');
    window.location.href = '/login';
  };

  return (
    <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[32px] border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex items-center gap-6">
        <div className="w-12 h-12 bg-black rounded-[16px] flex items-center justify-center text-white shadow-lg">
          <UserIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-black text-black uppercase tracking-tight">{userName}</h2>
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black leading-none mt-1">{userEmail}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="px-4 py-2 bg-zinc-50 rounded-full border border-zinc-100 hidden md:flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{VERSION}</span>
        </div>
        
        <a 
            href="/profile"
            className="flex items-center gap-2 px-6 py-3 bg-white text-zinc-900 duration-300 font-black text-[11px] uppercase tracking-widest border border-zinc-100 shadow-sm rounded-2xl hover:bg-zinc-50"
        >
            <UserIcon className="w-4 h-4" />
            Mi Perfil
        </a>
        
        <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 bg-white text-rose-600 hover:bg-rose-50 rounded-2xl transition-all duration-300 font-black text-[11px] uppercase tracking-widest border border-rose-100 shadow-sm"
        >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Header;
