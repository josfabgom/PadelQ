import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import Header from '../components/Header';
import { 
  Users, CreditCard, ArrowLeft, Search, Plus, 
  TrendingUp, TrendingDown, Clock, Save, X, 
  Filter, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';

interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: number; // 0 for Charge, 1 for Payment
  description: string;
}

interface User {
  id: string;
  fullName: string;
  dni: string;
  email: string;
  balance: number;
  membershipName?: string;
  expiryDate?: string;
  coverageStartDate?: string;
}

const CtaCte = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userMembership, setUserMembership] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | string>('');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users', getAuthConfig());
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users", err);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await api.get('/api/PaymentMethods', getAuthConfig());
      setPaymentMethods(res.data.filter((m: any) => m.isActive));
    } catch (err) {
      console.error("Error fetching payment methods", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPaymentMethods();
  }, []);


  const fetchTransactions = async (userId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/transaction/user/${userId}`, getAuthConfig());
      setTransactions(res.data);
    } catch (err) {
      console.error("Error fetching transactions", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserMembership = async (userId: string) => {
    setMembershipLoading(true);
    try {
      const res = await api.get(`/api/membership/user/${userId}`, getAuthConfig());
      setUserMembership(res.data);
    } catch (err) {
      console.error("Error fetching membership", err);
      setUserMembership(null);
    } finally {
      setMembershipLoading(false);
    }
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    fetchTransactions(user.id);
    fetchUserMembership(user.id);
  };

  const handleQuickPay = (amount: number, description: string) => {
    setPaymentAmount(amount.toString());
    setPaymentDesc(description);
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedUser || !paymentAmount) return;

    try {
      await api.post(`/api/transaction/payment?userId=${selectedUser.id}&amount=${paymentAmount}&description=${paymentDesc}&paymentMethodId=${selectedPaymentMethodId}`, {}, getAuthConfig());
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentDesc('');
      setSelectedPaymentMethodId('');
      fetchTransactions(selectedUser.id);
      fetchUsers(); // Refresh balance in the main list
    } catch (err) {
      console.error("Error recording payment", err);
    }
  };


  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) || 
    u.dni?.includes(search)
  );

  return (
    <div className="p-10 space-y-10 bg-[#fafafa] min-h-screen font-oak">
      <Header />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300">
            <ArrowLeft className="w-5 h-5 text-black" />
          </a>
          <div>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase italic">Cuentas Corrientes</h1>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Gestión de Saldos y Cobranzas</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Buscar cliente (Nombre o DNI)..."
              className="pl-12 pr-6 py-4 bg-white border border-black/5 rounded-[20px] text-sm font-medium w-80 shadow-sm focus:outline-none focus:border-black/20 transition-all font-oak"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* User List Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-[32px] border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
            <div className="p-6 border-b border-zinc-50 flex items-center gap-3">
              <Users className="w-5 h-5 text-zinc-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-black">Clientes</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-zinc-50">
              {filteredUsers.map(user => (
                <button 
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className={`w-full p-6 flex flex-col items-start transition-all duration-300 hover:bg-zinc-50 group ${selectedUser?.id === user.id ? 'bg-zinc-50 border-r-4 border-black' : ''}`}
                >
                  <div className="flex justify-between w-full mb-1">
                    <span className="text-sm font-black text-black uppercase tracking-tight">{user.fullName}</span>
                    <span className={`text-[11px] font-black ${user.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ${Math.abs(user.balance).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-zinc-400 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">DNI: {user.dni || 'S/D'}</span>
                    <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black">{user.membershipName || 'Sin Club'}</span>
                    {user.expiryDate && (
                      <>
                        <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">
                          Vence: {new Date(user.expiryDate).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction History Area */}
        <div className="lg:col-span-8">
          {selectedUser ? (
            <div className="space-y-8">
              {/* User Summary Card */}
              <div className="bg-black p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[120%] bg-white/5 blur-[100px] rounded-full"></div>
                <CreditCard className="absolute -right-8 -bottom-8 h-48 w-48 text-white/5 rotate-12" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">Cliente Seleccionado</p>
                      <h3 className="text-3xl font-black text-white uppercase italic tracking-tight">{selectedUser.fullName}</h3>
                    </div>
                    <button 
                      onClick={() => setShowPaymentModal(true)}
                      className="px-6 py-4 bg-white text-black rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-3"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar Pago
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Deuda Pendiente</p>
                      <p className={`text-4xl font-black italic ${selectedUser.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ${selectedUser.balance.toLocaleString()}
                      </p>
                    </div>
                    {userMembership && (
                      <div className="col-span-2 flex items-center justify-between bg-white/5 border border-white/10 p-6 rounded-[30px] hover:bg-white/10 transition-all cursor-pointer group/card"
                           onClick={() => handleQuickPay(userMembership.membership.monthlyPrice, `Pago Cuota Mensual - ${userMembership.membership.name}`)}>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Membresía Activa</p>
                          <p className="text-xl font-black text-white italic uppercase tracking-tight">{userMembership.membership.name}</p>
                          <div className="flex gap-4 mt-2">
                            <div>
                               <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Cobertura Desde</p>
                               <p className="text-[10px] font-bold text-white/70 uppercase">
                                 {new Date(userMembership.coverageStartDate).toLocaleDateString()}
                               </p>
                            </div>
                            <div className="w-px h-6 bg-white/10 self-end mb-1"></div>
                            <div>
                               <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Vencimiento</p>
                               <p className={`text-[10px] font-bold uppercase ${userMembership.isExpired ? 'text-rose-400' : 'text-white/70'}`}>
                                 {new Date(userMembership.expiryDate).toLocaleDateString()}
                               </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[9px] font-black text-white/40 mb-2 italic uppercase tracking-widest">CUOTA MENSUAL</p>
                           <span className="px-5 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest group-hover/card:scale-105 transition-all flex items-center gap-3">
                              <CreditCard className="w-4 h-4" />
                              Pagar ${userMembership.membership.monthlyPrice.toLocaleString()}
                           </span>
                        </div>
                      </div>
                    )}
                    {/* Display basic membership info if complex data is missing */}
                    {!userMembership && !membershipLoading && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Membresía</p>
                        <div className="flex items-center gap-6">
                            <p className="text-xl font-black text-white italic uppercase">{selectedUser.membershipName || 'Visitante'}</p>
                            {selectedUser.expiryDate && (
                                <div className="flex gap-4 items-center bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Vigencia</span>
                                        <span className="text-[10px] font-bold text-white/70 uppercase">
                                            {selectedUser.coverageStartDate ? new Date(selectedUser.coverageStartDate).toLocaleDateString() : 'S/D'} - {new Date(selectedUser.expiryDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-[40px] shadow-sm border border-black/5 overflow-hidden">
                <div className="p-8 border-b border-zinc-50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-zinc-400" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-black italic">Historial Segregado</h2>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-zinc-50 rounded-full text-[9px] font-black uppercase tracking-tighter text-zinc-400 border border-zinc-100">Cargos (+)</span>
                    <span className="px-3 py-1 bg-zinc-50 rounded-full text-[9px] font-black uppercase tracking-tighter text-zinc-400 border border-zinc-100">Pagos (-)</span>
                  </div>
                </div>
                
                {loading ? (
                  <div className="p-20 text-center flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-zinc-100 border-t-black rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cargando movimientos...</p>
                  </div>
                ) : transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50/50">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">Fecha</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">Descripción</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">Tipo</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right italic">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {transactions.map(t => (
                          <tr key={t.id} className="hover:bg-zinc-50/30 transition-all group">
                            <td className="px-8 py-6 text-xs font-bold text-zinc-500 font-mono">
                              {new Date(t.date).toLocaleDateString()}
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-xs font-bold text-black group-hover:italic transition-all">{t.description}</span>
                            </td>
                            <td className="px-8 py-6 uppercase tracking-tighter text-[10px] font-black">
                              {t.type === 0 ? (
                                <span className="flex items-center gap-1.5 text-rose-500">
                                  <TrendingUp className="w-3 h-3" /> CARGO
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-emerald-500">
                                  <TrendingDown className="w-3 h-3" /> PAGO
                                </span>
                              )}
                            </td>
                            <td className={`px-8 py-6 text-right font-black text-sm ${t.type === 0 ? 'text-black' : 'text-emerald-600'}`}>
                              {t.type === 0 ? '' : '-'}${t.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-20 text-center flex flex-col items-center gap-4">
                    <AlertCircle className="w-8 h-8 text-zinc-200" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">Sin movimientos registrados</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[40px] border border-black/5 shadow-sm text-center p-10">
              <div className="w-20 h-20 bg-zinc-50 rounded-[30px] flex items-center justify-center mb-6">
                <FileText className="w-8 h-8 text-zinc-300" />
              </div>
              <h3 className="text-xl font-black text-zinc-400 italic uppercase tracking-tight">Selecciona un Cliente</h3>
              <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mt-2 max-w-[240px]">
                Escoge un cliente de la lista lateral para visualizar su cuenta corriente detallada.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10 relative animate-in slide-in-from-bottom-8 duration-500">
            <button 
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-8 top-8 p-3 bg-zinc-50 hover:bg-zinc-100 rounded-[15px] transition-all"
            >
              <X className="w-4 h-4 text-black" />
            </button>

            <header className="mb-10">
              <h2 className="text-2xl font-black text-black italic uppercase italic tracking-tight">Registrar Cobranza</h2>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-1">Ingreso de Pago a Cuenta</p>
            </header>

            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 block italic">Importe del Pago ($)</label>
                <div className="relative">
                   <div className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black italic text-zinc-300">$</div>
                   <input 
                    type="number" 
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-[24px] pl-14 pr-8 py-6 text-3xl font-black italic focus:outline-none focus:border-black/10 transition-all font-oak"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 block italic">Medio de Pago</label>
                <select 
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-[24px] px-8 py-5 text-sm font-bold focus:outline-none focus:border-black/10 transition-all font-oak"
                  value={selectedPaymentMethodId}
                  onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                >
                  <option value="">Seleccione medio...</option>
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 block italic">Descripción / Concepto</label>

                <textarea 
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-[24px] px-8 py-5 text-sm font-bold focus:outline-none focus:border-black/10 transition-all font-oak resize-none h-32"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="Ej: Pago cuota Mayo / Efectivo..."
                />
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleRecordPayment}
                  disabled={!paymentAmount}
                  className="w-full py-6 bg-black text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-4"
                >
                  <Save className="w-4 h-4" />
                  Confirmar Operación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CtaCte;
