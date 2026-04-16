import React, { useState, useEffect, useMemo } from 'react';
import api, { getAuthConfig } from '../api/api';
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  User, 
  Clock, 
  Check,
  X,
  Search,
  Filter,
  DollarSign,
  Trash2,
  Users
} from 'lucide-react';
import Header from '../components/Header';

interface Court {
  id: number;
  name: string;
  pricePerHour: number;
}

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  courtId: number;
  court: { name: string };
  userId?: string;
  user?: { fullName: string };
  guestName?: string;
  status: number;
  price: number;
}

interface Client {
  id: string;
  fullName: string;
  email: string;
}

const BookingsPage = () => {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ court: Court, hour: number } | null>(null);
  
  // Form states
  const [bookingType, setBookingType] = useState<'existing' | 'guest'>('existing');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [duration, setDuration] = useState(60);
  const [searchClient, setSearchClient] = useState('');

  const config = getAuthConfig();

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [courtsRes, bookingsRes, clientsRes] = await Promise.all([
        api.get('/api/courts', config),
        api.get(`/api/bookings/by-date?date=${dateStr}`, config),
        api.get('/api/users', config)
      ]);
      setCourts(courtsRes.data);
      setBookings(bookingsRes.data);
      setClients(clientsRes.data);
    } catch (err) {
      console.error("Error al cargar datos", err);
    } finally {
      setLoading(false);
    }
  };

  const hours = Array.from({ length: 15 }, (_, i) => 8 + i); // 8:00 to 22:00

  const filteredClients = useMemo(() => {
    if (!searchClient) return [];
    return clients.filter(c => 
      c.fullName.toLowerCase().includes(searchClient.toLowerCase()) ||
      c.email.toLowerCase().includes(searchClient.toLowerCase())
    ).slice(0, 5);
  }, [clients, searchClient]);

  const getBookingFor = (courtId: number, hour: number) => {
    return bookings.find(b => {
      const start = parseISO(b.startTime);
      return b.courtId === courtId && start.getHours() === hour;
    });
  };

  const handleOpenBooking = (court: Court, hour: number) => {
    const existing = getBookingFor(court.id, hour);
    if (existing) return; // Or handle editing

    setSelectedTimeSlot({ court, hour });
    setIsModalOpen(true);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimeSlot) return;

    const startTime = new Date(selectedDate);
    startTime.setHours(selectedTimeSlot.hour, 0, 0, 0);

    const payload = {
      courtId: selectedTimeSlot.court.id,
      startTime: startTime.toISOString(),
      durationMinutes: duration,
      userId: bookingType === 'existing' ? selectedClientId : null,
      guestName: bookingType === 'guest' ? guestName : null
    };

    try {
      await api.post('/api/bookings/admin-create', payload, config);
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      alert(err.response?.data || "Error al crear reserva");
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (window.confirm('¿Liberar este turno?')) {
      try {
        await api.delete(`/api/bookings/${id}`, config);
        fetchData();
      } catch (err) {
        console.error("Error al cancelar", err);
      }
    }
  };

  const resetForm = () => {
    setBookingType('existing');
    setSelectedClientId('');
    setGuestName('');
    setDuration(60);
    setSearchClient('');
  };

  // Horizontal Date Selector (7 days)
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  return (
    <div className="p-8 space-y-8 bg-[#FAFAFA] min-h-screen font-outfit">
      <Header />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight uppercase italic">Gestión de Alquileres</h1>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CALENDARIO INTERACTIVO DE CANCHAS v3.2</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-zinc-100 shadow-sm">
            <button 
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 text-sm font-black uppercase italic">
                {format(selectedDate, "d 'DE' MMMM", { locale: es })}
            </div>
            <button 
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Day Picker */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`flex-shrink-0 w-24 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all duration-300 border ${
                isSelected 
                  ? 'bg-black text-white border-black shadow-xl shadow-black/20' 
                  : 'bg-white text-zinc-400 border-zinc-100 hover:border-black/10'
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-tighter opacity-60">
                {format(day, 'EEE', { locale: es })}
              </span>
              <span className="text-xl font-black italic">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Grid View */}
      <div className="bg-white rounded-[40px] shadow-[0_20px_60px_rgb(0,0,0,0.03)] border border-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
             {/* Header */}
             <div className="grid grid-cols-[120px_repeat(auto-fit,minmax(200px,1fr))] border-b border-zinc-100">
                <div className="p-6 bg-zinc-50/50 border-r border-zinc-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-zinc-300" />
                </div>
                {courts.map(court => (
                    <div key={court.id} className="p-6 text-center">
                        <h3 className="text-sm font-black uppercase italic tracking-wider">{court.name}</h3>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-1">${court.pricePerHour}/H</p>
                    </div>
                ))}
            </div>

            {/* Matrix */}
            {hours.map(hour => (
                <div key={hour} className="grid grid-cols-[120px_repeat(auto-fit,minmax(200px,1fr))] group">
                    <div className="p-6 border-r border-b border-zinc-100 bg-zinc-50/30 flex items-center justify-center font-black italic text-zinc-400 text-sm group-hover:text-black transition-colors">
                        {hour.toString().padStart(2, '0')}:00
                    </div>
                    {courts.map(court => {
                        const booking = getBookingFor(court.id, hour);
                        return (
                            <div 
                                key={`${court.id}-${hour}`}
                                className="border-b border-zinc-100 p-2 min-h-[100px] relative hover:bg-zinc-50/50 transition-all cursor-pointer"
                                onClick={() => handleOpenBooking(court, hour)}
                            >
                                {booking ? (
                                    <div className="absolute inset-2 bg-black text-white rounded-2xl p-4 shadow-lg flex flex-col justify-between overflow-hidden group/item">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-tighter text-white/40 mb-1">OCUPADO</p>
                                                <p className="text-xs font-black uppercase italic leading-tight">
                                                    {booking.user?.fullName || booking.guestName || "SIN NOMBRE"}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleCancelBooking(booking.id); }}
                                                className="p-1.5 bg-white/10 hover:bg-rose-600 rounded-lg transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Confirmado</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <div className="p-3 bg-zinc-100 rounded-2xl">
                                            <Plus className="w-4 h-4 text-zinc-400" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {isModalOpen && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-10 bg-black text-white relative">
                    <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <h2 className="text-3xl font-black italic uppercase tracking-tight">Nueva Reserva</h2>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                        {selectedTimeSlot.court.name} • {selectedTimeSlot.hour}:00 HS • {format(selectedDate, "d 'DE' MMMM", { locale: es })}
                    </p>
                </div>

                <form onSubmit={handleCreateBooking} className="p-10 space-y-8">
                    <div className="grid grid-cols-2 gap-4 p-2 bg-zinc-100 rounded-[24px]">
                        <button 
                            type="button"
                            onClick={() => setBookingType('existing')}
                            className={`py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'existing' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                        >
                            <Users className="w-4 h-4 inline-block mr-2" /> CLIENTE APP
                        </button>
                        <button 
                            type="button"
                            onClick={() => setBookingType('guest')}
                            className={`py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'guest' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                        >
                            <User className="w-4 h-4 inline-block mr-2" /> PARTICULAR
                        </button>
                    </div>

                    {bookingType === 'existing' ? (
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Buscar Cliente</label>
                            <div className="relative">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 w-5 h-5" />
                                <input 
                                    type="text"
                                    value={searchClient}
                                    onChange={(e) => setSearchClient(e.target.value)}
                                    className="w-full pl-16 pr-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300"
                                    placeholder="Nombre o Email..."
                                />
                            </div>
                            
                            {filteredClients.length > 0 && (
                                <div className="space-y-2 mt-4 animate-in slide-in-from-top-2 duration-200">
                                    {filteredClients.map(client => (
                                        <button
                                            key={client.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedClientId(client.id);
                                                setSearchClient(client.fullName);
                                            }}
                                            className={`w-full p-4 flex items-center justify-between rounded-2xl border transition-all ${
                                                selectedClientId === client.id 
                                                ? 'bg-black text-white border-black' 
                                                : 'bg-white text-zinc-600 border-zinc-100 hover:border-black/20'
                                            }`}
                                        >
                                            <span className="font-bold">{client.fullName}</span>
                                            {selectedClientId === client.id && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nombre del Particular</label>
                            <input 
                                type="text"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300"
                                placeholder="Ej: Juan Pérez..."
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Duración del Turno</label>
                        <div className="grid grid-cols-3 gap-4">
                            {[60, 90, 120].map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setDuration(d)}
                                    className={`py-4 rounded-[20px] text-xs font-black tracking-widest transition-all border ${
                                        duration === d 
                                        ? 'bg-black text-white border-black' 
                                        : 'bg-white text-zinc-500 border-zinc-100 hover:border-black/20'
                                    }`}
                                >
                                    {d} MIN
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button 
                            type="button"
                            onClick={() => { setIsModalOpen(false); resetForm(); }}
                            className="flex-1 py-6 bg-zinc-50 text-zinc-400 rounded-[28px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="flex-2 py-6 bg-black text-white rounded-[28px] font-black uppercase tracking-widest shadow-2xl shadow-black/20 hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
                        >
                            <Check className="w-5 h-5" /> Confirmar Reserva
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
