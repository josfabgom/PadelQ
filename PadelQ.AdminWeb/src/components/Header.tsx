import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';

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
    <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
          <UserIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{userName}</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{userEmail}</p>
        </div>
      </div>
      
      <button 
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-bold text-sm border border-rose-100 shadow-sm"
      >
        <LogOut className="w-4 h-4" />
        Cerrar Sesión
      </button>
    </div>
  );
};

export default Header;
