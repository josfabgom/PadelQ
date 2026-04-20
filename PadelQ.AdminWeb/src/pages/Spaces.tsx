import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
  format, 
  addDays, 
  startOfToday, 
  parseISO 
} from 'date-fns';
import { es } from 'date-fns/locale/es';
import { 
  Plus, 
  X, 
  DollarSign, 
  LayoutGrid,
  MapPin,
  Clock,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowLeft
} from 'lucide-react';
import Header from '../components/Header';

interface Space {
  id: number;
  name: string;
  description: string;
  pricePerSlot: number;
  isActive: boolean;
}

interface SpaceBooking {
  id: string;
  startTime: string;
  endTime: string;
  spaceId: number;
  space: { name: string };
  userId?: string;
  user?: { fullName: string };
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  guestAddress?: string;
  status: number;
  price: number;
  depositPaid: number;
}

const SpacesPage = () => {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [bookings, setBookings] = useState<SpaceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const [selectedSlot, setSelectedSlot] = useState<{ space: Space, hour: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<SpaceBooking | null>(null);
  
  // Booking Form
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [duration, setDuration] = useState(120); 
  const [depositPaid, setDepositPaid] = useState(0);
  const [bookingPrice, setBookingPrice] = useState<number | null>(null);

  const config = getAuthConfig();

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [spacesRes, bookingsRes] = await Promise.all([
        api.get('/api/spaces', config),
        api.get(`/api/spacebookings/by-date?date=${dateStr}`, config)
      ]);
      setSpaces(spacesRes.data.filter((s: Space) => s.isActive));
      setBookings(bookingsRes.data);
    } catch (err) {
      console.error("Error al cargar espacios", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = (space: Space, hour: number) => {
    const existing = bookings.find(b => {
      const start = parseISO(b.startTime);
      const end = parseISO(b.endTime);
      const slot = new Date(selectedDate);
      slot.setHours(hour, 0, 0, 0);
      return b.spaceId === space.id && slot >= start && slot < end && b.status !== 2;
    });

    if (existing) {
      setSelectedBooking(existing);
      setIsDetailsModalOpen(true);
    } else {
      setSelectedSlot({ space, hour });
      setBookingPrice(space.pricePerSlot);
      setIsBookingModalOpen(true);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    try {
      const startTime = new Date(selectedDate);
      startTime.setHours(selectedSlot.hour, 0, 0, 0);

      const payload = {
        spaceId: selectedSlot.space.id,
        guestName,
        guestPhone,
        guestEmail,
        guestAddress,
        startTime: startTime.toISOString(),
        durationMinutes: duration,
        depositPaid,
        price: bookingPrice
      };

      await api.post('/api/spacebookings/admin-create', payload, config);
      setIsBookingModalOpen(false);
      resetBookingForm();
      fetchData();
    } catch (err: any) {
      alert(err.response?.data || "Error al crear reserva");
    }
  };

  const resetBookingForm = () => {
    setGuestName('');
    setGuestPhone('');
    setGuestEmail('');
    setGuestAddress('');
    setDuration(120);
    setDepositPaid(0);
    setBookingPrice(null);
  };

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0];

  return (
    <div className="p-8 space-y-8 bg-[#fafafa] min-h-screen font-oak">
      <Header />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-4xl font-black text-black tracking-tight mb-1 uppercase italic">Alquiler de Espacios</h1>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Calendario de Reservas (Quinchos, Parrillas, Salones)</p>
          </div>
        </div>

        <div className="flex gap-4">
             <button onClick={() => setSelectedDate(startOfToday())} className="px-6 py-3 bg-white text-[10px] font-black uppercase tracking-widest border border-black/5 rounded-2xl hover:bg-zinc-50 transition-all shadow-sm">Hoy</button>
             <a href="/manage-spaces" className="px-6 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-xl flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Administrar Unidades
             </a>
        </div>
      </div>

      <div className="space-y-6">
            {/* Header Calendario */}
            <div className="flex items-center justify-center bg-white p-6 rounded-[32px] border border-black/5 shadow-sm relative">
                <div className="flex items-center gap-8">
                    <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-3 hover:bg-zinc-100 rounded-2xl transition-all border border-transparent hover:border-zinc-200">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="text-center min-w-[280px]">
                        <h3 className="text-2xl font-black uppercase italic tracking-tight">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</h3>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">SISTEMA INTEGRAL DE ESPACIOS</p>
                    </div>
                    <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-3 hover:bg-zinc-100 rounded-2xl transition-all border border-transparent hover:border-zinc-200">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Grid Calendario */}
            <div className="bg-white rounded-[40px] border border-black/5 shadow-xl overflow-hidden">
                {loading ? (
                    <div className="p-40 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-zinc-100 border-t-black rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sincronizando Agenda...</p>
                    </div>
                ) : spaces.length === 0 ? (
                    <div className="p-40 text-center flex flex-col items-center gap-6">
                        <div className="w-20 h-20 bg-zinc-50 rounded-[30px] flex items-center justify-center">
                            <LayoutGrid className="w-8 h-8 text-zinc-200" />
                        </div>
                        <div>
                            <p className="text-xl font-black uppercase italic text-black">No hay unidades operativas</p>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">Favor de configurar los espacios en el panel de administración</p>
                        </div>
                        <a href="/manage-spaces" className="px-8 py-4 bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-2xl">Ir a Administración</a>
                    </div>
                ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-zinc-50/50">
                                <th className="p-6 border-b border-zinc-100 text-left w-32 sticky left-0 bg-zinc-50 z-10">
                                    <Clock className="w-4 h-4 text-zinc-400" />
                                </th>
                                {spaces.map(space => (
                                    <th key={space.id} className="p-6 border-b border-zinc-100 min-w-[240px]">
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">{space.description || 'Espacio Común'}</p>
                                            <p className="text-lg font-black uppercase italic text-black">{space.name}</p>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {hours.map(hour => (
                                <tr key={hour} className="group">
                                    <td className="p-8 border-b border-zinc-50 text-sm font-black text-zinc-300 uppercase tracking-widest sticky left-0 bg-white group-hover:bg-zinc-50 transition-colors">
                                        {hour}:00
                                    </td>
                                    {spaces.map(space => {
                                        const booking = bookings.find(b => {
                                          const start = parseISO(b.startTime);
                                          const end = parseISO(b.endTime);
                                          const slot = new Date(selectedDate);
                                          slot.setHours(hour, 0, 0, 0);
                                          return b.spaceId === space.id && slot >= start && slot < end && b.status !== 2;
                                        });

                                        const isStart = booking && parseISO(booking.startTime).getHours() === hour;

                                        return (
                                            <td key={space.id} onClick={() => handleOpenBooking(space, hour)} className="p-3 border-b border-zinc-50 group-hover:bg-zinc-50/30 transition-colors cursor-pointer relative h-24">
                                                {booking ? (
                                                    isStart && (
                                                        <div className="absolute inset-x-3 top-3 bottom-3 bg-black text-white p-5 rounded-[24px] shadow-2xl z-10 animate-in fade-in zoom-in duration-300 group-hover:scale-[1.02] transition-transform">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-[9px] font-black opacity-40 uppercase tracking-tight mb-1">Responsable:</p>
                                                                    <p className="text-sm font-black uppercase italic truncate">{booking.user?.fullName || booking.guestName}</p>
                                                                </div>
                                                                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase shadow-lg ${booking.depositPaid >= booking.price ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                                                                    {booking.depositPaid >= booking.price ? 'Pagado' : 'Seña'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="w-full h-full rounded-[24px] border-4 border-dashed border-transparent group-hover:border-zinc-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                        <Plus className="w-6 h-6 text-zinc-100" />
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                )}
            </div>
        </div>

      {/* Booking Modal */}
      {isBookingModalOpen && selectedSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="p-12 bg-black text-white relative">
                    <button onClick={() => setIsBookingModalOpen(false)} className="absolute right-10 top-10 p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X className="w-8 h-8 font-thin" />
                    </button>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 shadow-inner">
                            <LayoutGrid className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 block">Confirmación de Reserva</span>
                            <h2 className="text-3xl font-black italic uppercase tracking-tight">{selectedSlot.space.name}</h2>
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                        <Clock className="w-4 h-4 text-white/40" />
                        <p className="text-white/60 text-[11px] font-black uppercase tracking-widest mt-0.5">
                            {format(selectedDate, "dd 'de' MMMM", { locale: es })} • {selectedSlot.hour}:00 HS
                        </p>
                    </div>
                </div>

                <form onSubmit={handleCreateBooking} className="p-12 space-y-10">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Nombre Responsable</label>
                            <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} required className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[24px] outline-none font-black text-sm focus:bg-white focus:border-black transition-all" placeholder="JUAN PEREZ" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Teléfono Móvil</label>
                            <input type="text" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} required className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[24px] outline-none font-black text-sm focus:bg-white focus:border-black transition-all" placeholder="+54 9..." />
                        </div>
                        <div className="space-y-3 col-span-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Email de Contacto</label>
                            <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[24px] outline-none font-black text-sm focus:bg-white focus:border-black transition-all" placeholder="EJEMPLO@MAIL.COM" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Duración Requerida</label>
                            <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[24px] outline-none font-black text-sm">
                                <option value={60}>1 Hora</option>
                                <option value={120}>2 Horas (Estandar)</option>
                                <option value={180}>3 Horas</option>
                                <option value={240}>4 Horas</option>
                                <option value={300}>5 Horas</option>
                                <option value={360}>Turno Completo</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Monto de Seña ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-600 w-5 h-5" />
                                <input type="number" value={depositPaid} onChange={e => setDepositPaid(Number(e.target.value))} className="w-full pl-14 pr-8 py-5 bg-emerald-50 border border-emerald-100 rounded-[24px] outline-none font-black text-xl text-emerald-700" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-6 pt-6">
                        <button type="button" onClick={() => setIsBookingModalOpen(false)} className="flex-1 py-6 bg-zinc-50 text-zinc-400 rounded-[30px] font-black uppercase tracking-[0.3em] hover:bg-zinc-100 transition-all">Cancelar</button>
                        <button type="submit" className="flex-2 py-6 bg-black text-white rounded-[30px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4">
                            <Check className="w-6 h-6" /> Confirmar Operación
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Details Modal (Checkout) */}
      {isDetailsModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[50px] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 scale-in-center">
                <div className="p-12 bg-black text-white relative">
                    <button onClick={() => setIsDetailsModalOpen(false)} className="absolute right-10 top-10 p-3 hover:bg-white/10 rounded-2xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 rounded-3xl bg-white/10 flex items-center justify-center border border-white/10">
                            <DollarSign className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 block mb-1">Liquidación / Saldo</span>
                            <p className="text-white/50 text-[11px] font-black uppercase tracking-widest italic">
                                {selectedBooking.space.name}
                            </p>
                        </div>
                    </div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-4">
                        {selectedBooking.user?.fullName || selectedBooking.guestName}
                    </h2>
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Reserva Confirmada</span>
                    </div>
                </div>

                <div className="p-12 space-y-10">
                    <div className="grid grid-cols-1 gap-5 bg-zinc-50 p-8 rounded-[35px] border border-zinc-100 italic">
                        <div className="flex items-center gap-5 text-xs font-black uppercase tracking-tight text-zinc-400">
                           <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-zinc-100 shadow-sm"><Phone className="w-3.5 h-3.5" /></div>
                           <span className="text-black">{selectedBooking.guestPhone || 'SIN CONTACTO'}</span>
                        </div>
                        <div className="flex items-center gap-5 text-xs font-black uppercase tracking-tight text-zinc-400">
                           <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-zinc-100 shadow-sm"><Mail className="w-3.5 h-3.5" /></div>
                           <span className="max-w-[240px] truncate text-black">{selectedBooking.guestEmail || 'SIN CORREO'}</span>
                        </div>
                         <div className="flex items-center gap-5 text-xs font-black uppercase tracking-tight text-zinc-400">
                           <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-zinc-100 shadow-sm"><MapPin className="w-3.5 h-3.5" /></div>
                           <span className="text-black">{selectedBooking.guestAddress || 'RETIRO EN LOCAL'}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-zinc-300 text-[10px] font-black uppercase tracking-[0.3em] font-oak italic">
                            <span>Coste Operativo</span>
                            <span>${selectedBooking.price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] font-oak italic">
                            <span>Crédito Aplicado (Seña)</span>
                            <span>-${selectedBooking.depositPaid.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-zinc-50 my-6"></div>
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.3em] block mb-2 italic">SALDO A CANCELAR</span>
                                <span className="text-5xl font-black italic text-black tracking-tighter">
                                    ${Math.max(0, selectedBooking.price - selectedBooking.depositPaid).toLocaleString()}
                                </span>
                            </div>
                            <div className="pb-1">
                                <span className="px-4 py-2 bg-black text-white text-[8px] font-black uppercase rounded-lg">ARS</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button 
                            onClick={async () => {
                                if(window.confirm('¿ELIMINAR ESTA RESERVA DEL SISTEMA?')) {
                                    await api.delete(`/api/spacebookings/${selectedBooking.id}`, config);
                                    setIsDetailsModalOpen(false);
                                    fetchData();
                                }
                            }}
                            className="flex-1 py-5 bg-rose-50 text-rose-500 rounded-[24px] font-black uppercase tracking-widest text-[9px] hover:bg-rose-100 transition-colors"
                        >
                            Anular Reserva
                        </button>
                        <button onClick={() => setIsDetailsModalOpen(false)} className="flex-2 py-5 bg-black text-white rounded-[24px] font-black uppercase tracking-widest text-[10px] shadow-[0_20px_35px_rgba(0,0,0,0.2)] hover:scale-[1.02] transition-all">
                            Finalizar Consulta
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SpacesPage;
