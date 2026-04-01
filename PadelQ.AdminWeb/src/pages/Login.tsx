import React, { useState } from 'react';
import api from '../api/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password
      });
      
      const { token, fullName, email: userEmail, roles } = response.data;
      
      // Strict Check for ADMIN role in this panel
      if (!roles || !roles.includes('Admin')) {
        setError('No tienes permisos de Administrador para acceder a este panel.');
        setLoading(false);
        return;
      }

      localStorage.setItem('padelq_token', token);
      localStorage.setItem('padelq_user_name', fullName);
      localStorage.setItem('padelq_user_email', userEmail);
      localStorage.setItem('padelq_user_roles', JSON.stringify(roles));
      
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-oak overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-white/10 blur-[100px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-2xl border border-white/5 rounded-[40px] p-12 shadow-[0_0_80px_rgba(0,0,0,0.5)] z-10 transition-all duration-700 hover:border-white/10">
        <div className="text-center mb-16">
          <img 
            src="/images/logo-full-white.png" 
            alt="BLACK Logo" 
            className="h-32 mx-auto mb-8 transform hover:scale-105 transition-transform duration-500"
          />
          <h1 className="text-[10px] uppercase tracking-[0.4em] font-bold text-zinc-500">
            Premium Management System
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div className="space-y-4">
            <div className="group">
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest pl-1 mb-2 group-focus-within:text-white transition-colors">Usuario</label>
              <input 
                type="text" 
                className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-1 focus:ring-white/20 text-white placeholder-zinc-600 focus:outline-none transition-all duration-300 hover:bg-zinc-800/80"
                placeholder="Ingresa tu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="group">
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest pl-1 mb-2 group-focus-within:text-white transition-colors">Contraseña</label>
              <input 
                type="password" 
                className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-1 focus:ring-white/20 text-white placeholder-zinc-600 focus:outline-none transition-all duration-300 hover:bg-zinc-800/80"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-rose-400 text-xs font-medium text-center bg-rose-500/10 py-3 rounded-xl border border-rose-500/20 animate-pulse">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-white hover:bg-zinc-200 text-black text-sm uppercase tracking-[0.2em] font-black rounded-2xl shadow-xl transform active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Validando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-12 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                Copyright © 2026 BLACK MARCA GRÁFICA
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
