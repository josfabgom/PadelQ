import React, { useState } from 'react';
import { User as UserIcon, LogOut, Key, CheckCircle, Shield, Mail, ArrowLeft } from 'lucide-react';
import api, { getAuthConfig } from '../api/api';
import Header from '../components/Header';

const ProfilePage = () => {
    const userName = localStorage.getItem('padelq_user_name') || 'Administrador';
    const userEmail = localStorage.getItem('padelq_user_email') || '';
    const userId = localStorage.getItem('padelq_user_id') || '';
    
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newPassword || newPassword !== confirmPassword) {
            setMessage({ text: 'Las contraseñas no coinciden o están vacías', type: 'error' });
            return;
        }

        setIsLoading(true);
        setMessage({ text: '', type: '' });
        
        try {
            const config = getAuthConfig();
            await api.post(`/api/users/${userId}/change-password`, { newPassword }, config);
            setMessage({ text: 'Contraseña actualizada correctamente', type: 'success' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error("Error al actualizar contraseña", err);
            setMessage({ text: 'Error al actualizar contraseña: ' + (err.response?.data || 'Desconocido'), type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 bg-zinc-50 min-h-screen font-outfit">
            <Header />
            
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-12">
                    <a 
                        href="/dashboard"
                        className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group"
                    >
                        <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
                    </a>
                    <div>
                        <h1 className="text-3xl font-black text-black">MI PERFIL</h1>
                        <p className="text-zinc-500 text-xs uppercase tracking-widest font-black">Administración de seguridad de cuenta</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* User Info Card */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-xl text-center">
                            <div className="w-24 h-24 bg-black rounded-[32px] flex items-center justify-center text-white mx-auto shadow-2xl mb-6">
                                <UserIcon className="w-10 h-10" />
                            </div>
                            <h2 className="text-xl font-black text-black uppercase tracking-tight mb-2">{userName}</h2>
                            <div className="flex items-center justify-center gap-2 text-zinc-400 text-[11px] font-black uppercase tracking-widest mb-6">
                                <Mail className="w-3 h-3" />
                                {userEmail}
                            </div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                                <Shield className="w-3 h-3" />
                                Acceso Total
                            </div>
                        </div>
                    </div>

                    {/* Change Password Form */}
                    <div className="md:col-span-2">
                        <div className="bg-white p-10 rounded-[32px] border border-black/5 shadow-xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-zinc-100 text-black rounded-2xl">
                                    <Key className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black uppercase tracking-tight">CAMBIAR CONTRASEÑA</h3>
                                    <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Asegura tu cuenta con una nueva clave</p>
                                </div>
                            </div>

                            {message.text && (
                                <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
                                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}>
                                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                    <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
                                </div>
                            )}

                            <form onSubmit={handleUpdatePassword} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Nueva Contraseña</label>
                                    <input 
                                        type="password" 
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all font-bold"
                                        placeholder="Min. 6 caracteres"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Confirmar Contraseña</label>
                                    <input 
                                        type="password" 
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all font-bold"
                                        placeholder="Repite la contraseña"
                                    />
                                </div>

                                <div className="pt-4">
                                    <button 
                                        type="submit"
                                        disabled={isLoading}
                                        className={`w-full py-5 rounded-[24px] font-black text-[12px] uppercase tracking-[3px] transition-all duration-300 shadow-2xl flex items-center justify-center gap-3 ${
                                            isLoading 
                                            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                                            : 'bg-black text-white hover:bg-zinc-800 hover:-translate-y-1'
                                        }`}
                                    >
                                        {isLoading ? 'Actualizando...' : 'GUARDAR CAMBIOS'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
