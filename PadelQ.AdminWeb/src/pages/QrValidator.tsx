import React, { useState } from 'react';
import axios from 'axios';
import { QrCode, User, Award, Percent, CheckCircle, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import Header from '../components/Header';

const QrValidator = () => {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleValidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const padelqToken = localStorage.getItem('padelq_token');
            const response = await axios.post('http://localhost:5041/api/membership/validate-qr', 
                JSON.stringify(token),
                { 
                    headers: { 
                        'Authorization': `Bearer ${padelqToken}`,
                        'Content-Type': 'application/json'
                    } 
                }
            );
            setResult(response.data);
            setToken(''); // Clear for next scan
        } catch (err: any) {
            setError(err.response?.data || 'Error al validar el código QR');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-outfit">
            <Header />
            <div className="max-w-2xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Validador de Membresía</h1>
                    <p className="text-slate-500">INGRESA EL TOKEN O ESCANEA EL CÓDIGO QR DEL SOCIO</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                    <form onSubmit={handleValidate} className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">Token de Validación</label>
                        <div className="relative">
                            <input 
                                type="text"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Pega el token aquí..."
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                                autoFocus
                            />
                            <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        </div>
                        <button 
                            type="submit"
                            disabled={loading || !token}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Validar Socio'}
                        </button>
                    </form>

                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-600">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {result && (
                        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-3 text-emerald-700">
                                <CheckCircle className="w-6 h-6" />
                                <h3 className="text-lg font-bold">Membresía Válida</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoCard 
                                    icon={<User className="w-5 h-5" />}
                                    label="Socio"
                                    value={result.userName}
                                />
                                <InfoCard 
                                    icon={<Award className="w-5 h-5" />}
                                    label="Plan"
                                    value={result.membershipName}
                                />
                                <InfoCard 
                                    icon={<Percent className="w-5 h-5" />}
                                    label="Descuento"
                                    value={`${result.discount}%`}
                                />
                                <div className="p-4 bg-white rounded-xl border border-emerald-100">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Estado</p>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        Activo
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="p-4 bg-white rounded-xl border border-emerald-100">
        <div className="flex items-center gap-2 text-slate-500 mb-1">
            {icon}
            <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-lg font-bold text-slate-800">{value}</p>
    </div>
);

export default QrValidator;
