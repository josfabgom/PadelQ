import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { Users as UsersIcon, Mail, Phone, Calendar, Search, Filter, X, CreditCard, ArrowLeft, Edit2, Trash2, Power, ShieldAlert, UserPlus, MapPin, Hash, Image as ImageIcon, DollarSign, ArrowRight, Key } from 'lucide-react';
import Header from '../components/Header';

interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  dni?: string;
  address?: string;
  city?: string;
  province?: string;
  photoUrl?: string;
  balance: number;
  membershipName?: string;
  membershipHexColor?: string;
  isActive: boolean;
  role?: string;
}

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [role, setRole] = useState('User');

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDescription, setPaymentDescription] = useState('');
  const [memberships, setMemberships] = useState<any[]>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState<number | string>('');

  const config = getAuthConfig();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users', config);
      setUsers(response.data);
    } catch (err) {
      console.error("Error al cargar usuarios", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberships = async () => {
    try {
      const response = await api.get('/api/membership', config);
      setMemberships(response.data);
    } catch (err) {
      console.error("Error al cargar membresías", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMemberships();
  }, []);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setDni('');
    setAddress('');
    setCity('');
    setProvince('');
    setPhotoUrl('');
    setIsActive(true);
    setPassword('');
    setNewPassword('');
    setRole('User');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.post(`/api/transaction/payment?userId=${selectedUser.id}&amount=${paymentAmount}&description=${paymentDescription}`, {}, config);
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentDescription('');
      fetchUsers();
    } catch (err) {
      console.error("Error al registrar pago", err);
    }
  };

  const handleAssignMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedMembershipId) return;
    try {
      await api.post(`/api/membership/subscribe?userId=${selectedUser.id}&membershipId=${selectedMembershipId}`, {}, config);
      setIsMembershipModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Error al asignar membresía", err);
    }
  };

  const fetchUserTransactions = async (userId: string) => {
    try {
      const response = await api.get(`/api/transaction/user/${userId}`, config);
      setUserTransactions(response.data);
    } catch (err) {
      console.error("Error al cargar transacciones", err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/users', {
        fullName,
        email,
        password,
        dni,
        phoneNumber: phone,
        role
      }, config);
      setIsCreateModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      console.error("Error al crear usuario", err);
      const errorData = err.response?.data;
      const errorMsg = typeof errorData === 'string' ? errorData : errorData?.title || errorData?.detail || JSON.stringify(errorData || "Error desconocido");
      
      if (errorMsg.includes('DNI_ALREADY_EXISTS')) {
        alert("Error: El DNI ya se encuentra registrado para otro cliente.");
      } else if (errorMsg.includes('DuplicateEmail') || errorMsg.includes('DuplicateUserName')) {
        alert("Error: El Email ya se encuentra registrado.");
      } else {
        alert("Error al crear usuario: " + errorMsg);
      }
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.put(`/api/users/${selectedUser.id}`, {
        fullName,
        email,
        phoneNumber: phone,
        isActive,
        dni,
        address,
        city,
        province,
        photoUrl,
        role
      }, config);
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error("Error al actualizar usuario", err);
      const errorData = err.response?.data;
      const errorMsg = typeof errorData === 'string' ? errorData : errorData?.title || errorData?.detail || JSON.stringify(errorData || "Error desconocido");
      
      if (errorMsg.includes('DNI_ALREADY_EXISTS')) {
        alert("Error: El DNI ya se encuentra registrado para otro cliente.");
      } else if (errorMsg.includes('DuplicateEmail') || errorMsg.includes('DuplicateUserName')) {
        alert("Error: El Email ya se encuentra registrado.");
      } else {
        alert("Error al actualizar usuario: " + errorMsg);
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    try {
      await api.post(`/api/users/${selectedUser.id}/change-password`, { newPassword }, config);
      setIsPasswordModalOpen(false);
      setNewPassword('');
      alert("Contraseña actualizada correctamente.");
    } catch (err: any) {
      console.error("Error al cambiar contraseña", err);
      alert("Error al cambiar contraseña: " + (err.response?.data || "Error desconocido"));
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("¿Está seguro de que desea eliminar este usuario?")) return;
    try {
      await api.delete(`/api/users/${id}`, config);
      fetchUsers();
    } catch (err: any) {
      console.error("Error al eliminar usuario", err);
      alert(err.response?.data || "No se pudo eliminar el usuario.");
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phoneNumber || '');
    setDni(user.dni || '');
    setAddress(user.address || '');
    setCity(user.city || '');
    setProvince(user.province || '');
    setPhotoUrl(user.photoUrl || '');
    setIsActive(user.isActive);
    setRole(user.role || 'User');
    setIsEditModalOpen(true);
  };

  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.dni && user.dni.includes(searchTerm))
  );

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-outfit">
      <Header />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Volver</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestión de Clientes</h1>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Listado de usuarios registrados</p>
          </div>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, email o DNI..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            />
          </div>
          <a 
            href="/ctacte"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <DollarSign className="w-4 h-4" />
            <span>Cuentas Corrientes</span>
          </a>
          <button 
            onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>

        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Membresía</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo (Deuda)</th>
                  <th className="px-6 py-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden border-2 border-white shadow-sm">
                          {user.photoUrl ? (
                            <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            user.fullName.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-900">{user.fullName}</div>
                            {!user.isActive && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded-full uppercase">Inactivo</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono uppercase">DNI: {user.dni || '---'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{user.phoneNumber || '---'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm`}
                        style={{ 
                          backgroundColor: user.membershipHexColor ? `${user.membershipHexColor}20` : '#f1f5f9',
                          color: user.membershipHexColor || '#64748b',
                          borderColor: user.membershipHexColor ? `${user.membershipHexColor}40` : '#e2e8f0'
                        }}
                      >
                        {user.membershipName || 'Sin Plan'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      <span className={user.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        ${user.balance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {user.role !== 'Staff' && user.role !== 'Merchant' && (
                          <>
                            <button 
                              onClick={() => { setSelectedUser(user); fetchUserTransactions(user.id); setIsHistoryModalOpen(true); }}
                              className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100 shadow-sm"
                              title="Ver Cta Cte / Historial"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => { setSelectedUser(user); setPaymentAmount(user.balance > 0 ? user.balance : 0); setIsPaymentModalOpen(true); }}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100 shadow-sm"
                              title="Registrar Pago"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => { setSelectedUser(user); setIsMembershipModalOpen(true); }}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100 shadow-sm"
                              title="Asignar Plan"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => openEditModal(user)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-100 shadow-sm"
                          title="Editar Datos"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setSelectedUser(user); setIsPasswordModalOpen(true); }}
                          className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors border border-violet-100 shadow-sm"
                          title="Cambiar Contraseña"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                {roles.includes('Admin') && (
                  <button 
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 shadow-sm"
                    title="Eliminar Cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No se encontraron usuarios que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL COBRO/PAGO */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 font-outfit">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-emerald-900">Registrar Pago</h2>
                  {selectedUser?.membershipName && (
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-[9px] font-black uppercase rounded-md">
                      {selectedUser.membershipName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">{selectedUser?.fullName}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-emerald-400 hover:text-emerald-600 p-2 hover:bg-emerald-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Membership Alert */}
            {selectedUser?.balance! > 0 && selectedUser?.membershipName && (
              <div className="mx-6 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Deuda Pendiente</div>
                    <div className="text-sm font-bold text-amber-900">Membresía: ${selectedUser.balance.toFixed(2)}</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setPaymentAmount(selectedUser.balance);
                    setPaymentDescription(`Pago Membresía - ${selectedUser.membershipName}`);
                  } }
                  className="px-3 py-2 bg-amber-600 text-white text-[10px] font-black uppercase rounded-lg shadow-md active:scale-95 transition-all"
                >
                  Saldar Total
                </button>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Monto del Pago ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="number" 
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Concepto/Descripción</label>
                <input 
                  type="text" 
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Ej: Pago cuota mensual"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 font-outfit">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <div>
                <h2 className="text-xl font-bold text-indigo-900">Nuevo Cliente</h2>
                <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest">Crear cuenta de acceso</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-indigo-400 hover:text-indigo-600 p-2 hover:bg-indigo-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">DNI (Clave Única)</label>
                  <input type="text" required value={dni} onChange={(e) => setDni(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Contraseña Inicial</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Rol de Usuario</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)} 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-indigo-600"
                  >
                    <option value="User">Cliente (Solo App Móvil)</option>
                    {roles.includes('Admin') && (
                      <>
                        <option value="Staff">Administración (Sin Borrar)</option>
                        <option value="Merchant">Comercio (Solo QR)</option>
                        <option value="Admin">Administrador (Acceso Total)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 px-4 py-3 border rounded-xl font-bold text-slate-600">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">Crear Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CLIENTE */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 font-outfit max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Editar Perfil de Cliente</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Información detallada del usuario</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-600 flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" /> Datos Personales
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nombre Completo</label>
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">DNI</label>
                    <input type="text" required value={dni} onChange={(e) => setDni(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                  </div>
                   <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Teléfono</label>
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-600 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Ubicación
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Dirección</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Localidad</label>
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Provincia</label>
                      <input type="text" value={province} onChange={(e) => setProvince(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">URL de Foto</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                         <input type="text" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                      </div>
                      {photoUrl && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border">
                          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    <Power className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Estado de la cuenta</div>
                    <div className="text-xs text-slate-500">{isActive ? 'La cuenta está ACTIVA' : 'La cuenta está INACTIVA'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-14 h-7 rounded-full transition-all relative shadow-inner ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${isActive ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-indigo-600 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Nivel de Acceso
                </h3>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Perfil del Usuario</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)} 
                    disabled={!roles.includes('Admin')}
                    className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 transition-all font-outfit ${!roles.includes('Admin') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="User">Cliente (Solo App Móvil)</option>
                    {roles.includes('Admin') && (
                      <>
                        <option value="Staff">Administración (Sin Borrar)</option>
                        <option value="Merchant">Comercio (Solo QR)</option>
                        <option value="Admin">Administrador (Acceso Total)</option>
                      </>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2">
                    {role === 'Admin' 
                      ? '⚠️ El Administrador puede gestionar canchas, precios, usuarios y ver reportes.' 
                      : 'El Usuario solo tiene acceso a sus propias reservas y actividad en la App Móvil.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white py-4 border-t border-slate-50">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-4 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR PLAN */}
      {isMembershipModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h2 className="text-xl font-bold text-indigo-900">Asignar Plan</h2>
              <button onClick={() => setIsMembershipModalOpen(false)} className="text-indigo-400 hover:text-indigo-600 p-2">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAssignMembership} className="p-6 space-y-4">
               <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Plan de Membresía</label>
                <select 
                  required
                  value={selectedMembershipId}
                  onChange={(e) => setSelectedMembershipId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">-- Seleccione un plan --</option>
                  {memberships.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (${m.monthlyPrice}/mes)</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsMembershipModalOpen(false)} className="flex-1 px-4 py-3 border rounded-xl font-bold text-slate-600">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200">Asignar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CTA CTE / HISTORIAL */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-outfit">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" /> Cuenta Corriente
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{selectedUser?.fullName}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {userTransactions.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <span className="text-sm font-bold text-indigo-900 uppercase">Saldo Actual</span>
                    <span className={`text-xl font-black ${selectedUser?.balance! > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ${selectedUser?.balance.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Movimientos Recientes</h3>
                    {userTransactions.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${t.type === 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {t.type === 0 ? <ArrowLeft className="w-4 h-4 rotate-180" /> : <ArrowLeft className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{t.description || (t.type === 0 ? 'Cargo' : 'Pago')}</div>
                            <div className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className={`font-bold ${t.type === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {t.type === 0 ? '+' : '-'}${t.amount.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <p>No hay movimientos registrados para este cliente.</p>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
               <button 
                onClick={() => { setIsHistoryModalOpen(false); setPaymentAmount(selectedUser?.balance! > 0 ? selectedUser?.balance! : 0); setIsPaymentModalOpen(true); }}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <DollarSign className="w-4 h-4" /> Registrar Pago
              </button>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR CONTRASEÑA */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-outfit">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-violet-50">
              <div>
                <h2 className="text-xl font-bold text-violet-900">Cambiar Contraseña</h2>
                <p className="text-xs text-violet-600 font-bold uppercase tracking-widest">{selectedUser?.fullName}</p>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-violet-400 hover:text-violet-600 p-2 hover:bg-violet-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all font-bold"
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">⚠️ Por razones de seguridad, el administrador puede resetear la contraseña del cliente sin conocer la anterior.</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-100"
                >
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
