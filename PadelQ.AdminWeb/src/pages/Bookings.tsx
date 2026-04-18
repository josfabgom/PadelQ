import React, { useState, useEffect, useMemo } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
  format, 
  addDays, 
  startOfToday, 
  isSameDay, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Users, 
  User, 
  Search, 
  Check, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  DollarSign, 
  Trash2,
  Calendar,
  MapPin,
  CalendarDays,
  LayoutGrid,
  ArrowLeft
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
  depositPaid: number;
  recurrenceGroupId?: string;
}

interface Client {
  id: string;
  fullName: string;
  email: string;
}

const BookingsPage = () => {
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ court: Court, hour: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [userMembership, setUserMembership] = useState<{ name: string, discount: number } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  
  // Form states
  const [bookingType, setBookingType] = useState<'existing' | 'guest'>('existing');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [duration, setDuration] = useState(60);
  const [searchClient, setSearchClient] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [depositPaid, setDepositPaid] = useState<number>(0);

  const config = getAuthConfig();

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [selectedDate, view]);

  useEffect(() => {
    // Auto-scroll to current hour on load
    if (view === 'daily' && !loading) {
        const currentHour = new Date().getHours();
        const element = document.getElementById(`hour-${currentHour}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [loading, view]);

  const [isConfirmingSeriesCancel, setIsConfirmingSeriesCancel] = useState(false);
  const [isConfirmingSeriesCancelSeriesId, setIsConfirmingSeriesCancelSeriesId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      let bookingsUrl = '';
      if (view === 'daily') {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        bookingsUrl = `/api/bookings/by-date?date=${dateStr}`;
      } else {
        const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
        bookingsUrl = `/api/bookings/by-range?start=${start}&end=${end}`;
      }

      const [courtsRes, bookingsRes, clientsRes, paymentsRes, settingsRes] = await Promise.all([
        api.get('/api/courts', config),
        api.get(bookingsUrl, config),
        api.get('/api/users', config),
        api.get('/api/PaymentMethods', config),
        api.get('/api/systemsettings', config)
      ]);
      setCourts(courtsRes.data);
      setBookings(bookingsRes.data);
      setClients(clientsRes.data);
      setPaymentMethods(paymentsRes.data.filter((m: any) => m.isActive));
      
      // Dinamizar horarios con soporte de Madrugada (Overnight)
      let openVal = settingsRes.data.find((s: any) => s.key === 'OpenHour')?.value || '8';
      let closeVal = settingsRes.data.find((s: any) => s.key === 'CloseHour')?.value || '23';

      let openHour = parseInt(openVal);
      let closeHour = parseInt(closeVal);
      
      if (isNaN(openHour) || isNaN(closeHour)) {
          openHour = 8;
          closeHour = 23;
      }

      const generatedHours = [];
      let current = openHour;
      
      // Lógica circular para horarios que cruzan la medianoche
      let safetyCount = 0;
      while (current !== closeHour && safetyCount < 24) {
          generatedHours.push(current);
          current = (current + 1) % 24;
          safetyCount++;
      }
      generatedHours.push(closeHour); // Añadir la hora de cierre final

      setHours(generatedHours);
    } catch (err) {
      console.error("Error al cargar datos", err);
    } finally {
      setLoading(false);
    }
  };

  const [hours, setHours] = useState<number[]>([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]);
  
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
      const end = parseISO(b.endTime);
      const startHour = start.getHours();
      const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
      
      return b.courtId === courtId && 
             isSameDay(start, selectedDate) &&
             hour >= startHour && 
             hour < endHour &&
             b.status !== 2;
    });
  };

  const getBookingsCountForDay = (day: Date) => {
    return bookings.filter(b => isSameDay(parseISO(b.startTime), day) && b.status !== 2).length;
  };

  const handleOpenBooking = async (court: Court, hour: number) => {
    const existing = getBookingFor(court.id, hour);
    
    if (existing) {
      setSelectedBooking(existing);
      setIsDetailsModalOpen(true);
      
      // Si hay un usuario, chequear membresía para informar descuento
      if (existing.userId) {
        try {
          // Buscamos si tiene membresía activa
          const res = await api.get(`/api/memberships/user/${existing.userId}`, config);
          if (res.data) {
            setUserMembership({ 
                name: res.data.membership?.name || 'Membresía', 
                discount: res.data.membership?.discountPercentage || 0 
            });
          } else {
            setUserMembership(null);
          }
        } catch (e) {
          setUserMembership(null);
        }
      } else {
        setUserMembership(null);
      }
      return;
    }

    setSelectedTimeSlot({ court, hour });
    setIsModalOpen(true);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimeSlot) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const hourStr = selectedTimeSlot.hour.toString().padStart(2, '0');
    const startTimeStr = `${dateStr}T${hourStr}:00:00`;

    const payload = {
      courtId: selectedTimeSlot.court.id,
      startTime: startTimeStr,
      durationMinutes: duration,
      userId: bookingType === 'existing' ? selectedClientId : null,
      guestName: bookingType === 'guest' ? guestName : null,
      isRecurring,
      endDate: isRecurring ? endDate : null,
      depositPaid
    };

    try {
      await api.post('/api/bookings/admin-create', payload, config);
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error("Error creating booking:", err);
      const errorMsg = err.response?.data?.message || err.response?.data || "Error al crear la reserva";
      alert(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    }
  };

  const handleCancelSeries = async (groupId: string) => {
    if (!isConfirmingSeriesCancel) {
        setIsConfirmingSeriesCancel(true);
        setIsConfirmingSeriesCancelSeriesId(groupId);
        return;
    }

    try {
        await api.delete(`/api/bookings/series/${groupId}`, config);
        setIsConfirmingSeriesCancel(false);
        setIsConfirmingSeriesCancelSeriesId(null);
        setIsDetailsModalOpen(false);
        fetchData();
        alert("La serie ha sido anulada con éxito.");
    } catch (err: any) {
        const errorDetail = err.response?.data || err.message;
        alert("Error al cancelar: " + errorDetail);
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
    setIsRecurring(false);
    setDepositPaid(0);
    setSelectedBooking(null);
    setUserMembership(null);
  };

  const handleConfirmPayment = async () => {
    if (!selectedBooking || !selectedPaymentMethod) {
        alert("Por favor seleccione un medio de pago");
        return;
    }
    try {
        // Marcamos la reserva como pagada (puedes añadir un campo status en el futuro)
        // Por ahora simulamos el éxito
        setIsDetailsModalOpen(false);
        resetForm();
        fetchData();
    } catch (err) {
        console.error("Error al procesar pago", err);
    }
  };

  // Horizontal Date Selector (Daily View)
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  // Monthly Calendar Logic
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="p-8 space-y-8 bg-[#FAFAFA] min-h-screen font-outfit">
      <Header />
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight uppercase italic">Gestión de Alquileres</h1>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">SISTEMA PROFESIONAL DE RESERVAS v3.5</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
            {/* View Toggle */}
            <div className="flex bg-white p-1 rounded-2xl border border-zinc-100 shadow-sm">
                <button 
                  onClick={() => setView('daily')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'daily' ? 'bg-black text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-50'}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Diario
                </button>
                <button 
                  onClick={() => setView('monthly')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'monthly' ? 'bg-black text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-50'}`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Mensual
                </button>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-zinc-100 shadow-sm">
                    <button 
                        onClick={() => setSelectedDate(view === 'daily' ? addDays(selectedDate, -1) : subMonths(selectedDate, 1))}
                        className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="px-4 text-sm font-black uppercase italic min-w-[140px] text-center">
                        {view === 'daily' 
                            ? format(selectedDate, "d 'DE' MMMM", { locale: es })
                            : format(selectedDate, "MMMM yyyy", { locale: es })}
                    </div>
                    <button 
                        onClick={() => setSelectedDate(view === 'daily' ? addDays(selectedDate, 1) : addMonths(selectedDate, 1))}
                        className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {view === 'daily' ? (
        <>
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

            {/* Grid View (Daily) */}
            <div className="bg-white rounded-[40px] shadow-[0_20px_60px_rgb(0,0,0,0.03)] border border-black/5 overflow-hidden">
                <div className="overflow-x-auto relative">
                    <div className="min-w-[1000px] relative">
                        {/* Time Indicator Line */}
                        {isSameDay(currentTime, selectedDate) && currentTime.getHours() >= 8 && currentTime.getHours() <= 22 && (
                            <div 
                                className="absolute left-0 right-0 z-40 flex items-center pointer-events-none transition-all duration-1000"
                                style={{ 
                                    top: `calc(72px + ${(currentTime.getHours() - 8) * 75}px + ${(currentTime.getMinutes() / 60) * 75}px)` 
                                }}
                            >
                                <div className="w-[120px] pr-4 flex justify-end">
                                    <span className="bg-rose-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg">AHORA</span>
                                </div>
                                <div className="flex-1 h-0.5 bg-rose-500/50 relative">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-rose-600 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)] animate-pulse"></div>
                                </div>
                            </div>
                        )}

                        {/* Header */}
                        <div className="grid grid-cols-[120px_repeat(auto-fit,minmax(200px,1fr))] border-b-2 border-zinc-200 bg-white sticky top-0 z-30">
                            <div className="p-4 bg-zinc-200/50 border-r-2 border-zinc-300 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-zinc-500" />
                            </div>
                            {courts.map((court, idx) => (
                                <div key={court.id} className={`p-4 text-center border-r-2 border-zinc-100 ${idx % 2 !== 0 ? 'bg-zinc-100/50' : 'bg-white'}`}>
                                    <h3 className="text-sm font-black uppercase italic tracking-wider text-black">{court.name}</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">${court.pricePerHour}/H</p>
                                </div>
                            ))}
                        </div>

                        {/* Matrix */}
                        {hours.map(hour => (
                            <div key={hour} id={`hour-${hour}`} className="grid grid-cols-[120px_repeat(auto-fit,minmax(200px,1fr))] group">
                                <div className="p-4 border-r-2 border-b border-zinc-200 bg-zinc-200/20 flex items-center justify-center font-black italic text-zinc-500 text-sm group-hover:bg-black group-hover:text-white transition-all">
                                    {hour.toString().padStart(2, '0')}:00
                                </div>
                                {courts.map((court, idx) => {
                                    const booking = getBookingFor(court.id, hour);
                                    const isStartHour = booking && parseISO(booking.startTime).getHours() === hour;

                                    // ... mantengo lógica de colores de reserva ...
                                    const palette = [
                                        'from-indigo-600 via-indigo-700 to-violet-800 shadow-indigo-500/40',
                                        'from-emerald-700 via-emerald-800 to-teal-900 shadow-emerald-500/40',
                                        'from-amber-600 via-orange-700 to-rose-700 shadow-orange-500/40',
                                        'from-cyan-700 via-blue-800 to-indigo-900 shadow-blue-500/40',
                                        'from-rose-700 via-pink-800 to-fuchsia-900 shadow-rose-500/40',
                                        'from-zinc-800 to-black shadow-zinc-950/50'
                                    ];
                                    const colorClass = booking ? palette[booking.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % palette.length] : '';

                                    let cardHeight = '100%';
                                    if (booking && isStartHour) {
                                        const start = parseISO(booking.startTime);
                                        const end = parseISO(booking.endTime);
                                        const dur = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                        cardHeight = `calc(${dur * 100}% + ${Math.floor(dur) * 1}px)`;
                                    }

                                    return (
                                        <div 
                                            key={`${court.id}-${hour}`}
                                            className={`border-b border-r-2 border-zinc-200/50 p-2 min-h-[75px] relative hover:bg-zinc-200/30 transition-all cursor-pointer group/cell ${idx % 2 !== 0 ? 'bg-zinc-100/40' : 'bg-white'}`}
                                            onClick={() => handleOpenBooking(court, hour)}
                                        >
                                            {booking ? (
                                                isStartHour && (
                                                    <div 
                                                        style={{ height: cardHeight }}
                                                        className={`absolute inset-x-2 top-2 text-white rounded-2xl p-4 shadow-2xl flex flex-col justify-between overflow-hidden group/item transition-all hover:scale-[1.01] border border-white/10 z-30 bg-gradient-to-br ${colorClass}`}
                                                    >
                                                        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 rotate-12 pointer-events-none transition-transform group-hover/item:translate-x-full duration-1000"></div>

                                                        <div className="flex justify-between items-start relative z-10">
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase tracking-tighter text-white/50 mb-1">
                                                                    {booking.userId ? 'VIP • CLIENTE APP' : 'RESERVA PARTICULAR'}
                                                                </p>
                                                                <p className="text-xs font-black uppercase italic leading-tight truncate max-w-[140px]">
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
                                                        
                                                        <div className="flex flex-col gap-1 relative z-10">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]"></div>
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Confirmado</span>
                                                            </div>
                                                            <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">
                                                                {format(parseISO(booking.startTime), 'HH:mm')} - {format(parseISO(booking.endTime), 'HH:mm')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
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
        </>
      ) : (
        /* Monthly View */
        <div className="bg-white rounded-[40px] shadow-[0_20px_60px_rgb(0,0,0,0.03)] border border-black/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-7 border-b border-zinc-100">
                {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map(dayName => (
                    <div key={dayName} className="p-6 text-center text-[10px] font-black text-zinc-400 tracking-[0.2em]">
                        {dayName}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                    const isToday = isSameDay(day, startOfToday());
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const bookingsCount = getBookingsCountForDay(day);
                    
                    return (
                        <div 
                            key={day.toISOString()}
                            onClick={() => {
                                setSelectedDate(day);
                                setView('daily');
                            }}
                            className={`min-h-[140px] p-6 border-r border-b border-zinc-50 cursor-pointer transition-all hover:bg-zinc-50 group flex flex-col justify-between ${!isCurrentMonth ? 'opacity-20' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-lg font-black italic ${isToday ? 'text-emerald-500 underline decoration-2 underline-offset-8' : 'text-black'}`}>
                                    {day.getDate()}
                                </span>
                                {bookingsCount > 0 && (
                                    <div className="px-2 py-1 bg-black text-white text-[9px] font-black rounded-lg">
                                        {bookingsCount} {bookingsCount === 1 ? ' TURNO' : ' TURNOS'}
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-1">
                                {bookingsCount > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {bookings.filter(b => isSameDay(parseISO(b.startTime), day)).slice(0, 5).map((b, idx) => (
                                            <div 
                                                key={idx} 
                                                className={`w-2 h-2 rounded-full transition-colors ${b.userId ? 'bg-indigo-500' : 'bg-zinc-300'}`}
                                                title={b.userId ? 'Cliente App' : 'Particular'}
                                            ></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* Booking Modal */}
      {isModalOpen && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-6 bg-black text-white relative">
                    <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute right-6 top-6 p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-white/10 rounded-lg">
                                <Calendar className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-white/40 text-[7px] font-black uppercase tracking-[0.2em]">Fecha</p>
                                <p className="text-xs font-black italic uppercase text-white leading-tight">
                                    {format(selectedDate, "eeee d", { locale: es })} <span className="text-emerald-500">/</span> {format(selectedDate, "MMMM", { locale: es })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-2xl pr-4 shadow-sm">
                            <div className="p-1.5 bg-emerald-500 rounded-lg">
                                <Clock className="w-4 h-4 text-black" />
                            </div>
                            <div>
                                <p className="text-emerald-500/60 text-[7px] font-black uppercase tracking-[0.2em]">Bloque</p>
                                <p className="text-sm font-black italic text-emerald-400 leading-tight tracking-tighter">
                                    {selectedTimeSlot.hour.toString().padStart(2, '0')}:00 {'>'} {((selectedTimeSlot.hour + (duration / 60)) % 24).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')} HS
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 py-1 px-2.5 bg-white/5 rounded-full w-fit">
                        <MapPin className="w-2.5 h-2.5 text-white/30" />
                        <span className="text-[7px] font-black uppercase tracking-widest text-white/30">{selectedTimeSlot.court.name}</span>
                    </div>
                </div>

                <form onSubmit={handleCreateBooking} className="p-7 space-y-6">
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


                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Duración</label>
                                    <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl">
                                        {[60, 90, 120].map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDuration(d)}
                                                className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                                                    duration === d 
                                                    ? 'bg-white text-black shadow-sm' 
                                                    : 'text-zinc-400 hover:bg-zinc-50'
                                                }`}
                                            >
                                                {d === 60 ? '1 HORA' : d === 90 ? '1.5 HORAS' : '2 HORAS'}
                                            </button>
                                        ))}
                                    </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Seña / Adelanto ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                <input 
                                    type="number"
                                    value={depositPaid}
                                    onChange={(e) => setDepositPaid(Number(e.target.value))}
                                    className="w-full pl-12 pr-6 py-4 bg-zinc-50 border border-zinc-100 rounded-[20px] focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 p-6 bg-zinc-50 rounded-[28px] border border-zinc-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isRecurring ? 'bg-black text-white' : 'bg-zinc-200 text-zinc-400'}`}>
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Tipo de Reserva</p>
                                    <p className="text-xs font-black uppercase italic">¿Es una serie semanal?</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRecurring(!isRecurring)}
                                className={`w-14 h-8 rounded-full relative transition-colors ${isRecurring ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${isRecurring ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>

                        {isRecurring && (
                            <div className="pt-4 mt-4 border-t border-zinc-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Repetir todos los {format(selectedDate, 'EEEE', { locale: es })} hasta:</label>
                                <input 
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={format(addDays(selectedDate, 7), 'yyyy-MM-dd')}
                                    className="w-full px-6 py-4 bg-white border border-zinc-200 rounded-2xl outline-none font-bold text-sm focus:ring-4 focus:ring-black/5"
                                />
                                <p className="text-[9px] font-bold text-zinc-400 italic">Se creará una reserva por semana automáticamente.</p>
                            </div>
                        )}
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

      {/* Checkout Modal */}
      {isDetailsModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 border border-black/5">
                <div className="p-10 bg-gradient-to-br from-zinc-800 to-black text-white relative">
                    <button onClick={() => { setIsDetailsModalOpen(false); resetForm(); }} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                            <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Checkout de Alquiler</span>
                    </div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tight">
                        {selectedBooking.user?.fullName || selectedBooking.guestName}
                    </h2>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                        {selectedBooking.court.name} • {format(parseISO(selectedBooking.startTime), 'HH:mm')} HS
                    </p>
                </div>

                <div className="p-10 space-y-8">
                    {/* Membership Info Alert */}
                    {userMembership ? (
                        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[28px] flex items-center gap-4 animate-pulse">
                            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                <Check className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">¡Descuento Disponible!</p>
                                <p className="text-sm font-black text-emerald-900 uppercase italic">{userMembership.name}</p>
                            </div>
                            <div className="ml-auto bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black">
                                -{userMembership.discount}%
                            </div>
                        </div>
                    ) : selectedBooking.userId && (
                        <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-[28px] flex items-center gap-4 grayscale opacity-50">
                            <div className="w-12 h-12 rounded-full bg-zinc-300 flex items-center justify-center text-white">
                                <X className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sin membresía activa</p>
                                <p className="text-sm font-black text-zinc-600 uppercase italic">Precio Regular</p>
                            </div>
                        </div>
                    )}

                    {/* Payment Method Selector */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block italic">Seleccionar Medio de Pago</label>
                        <div className="grid grid-cols-2 gap-4">
                            {paymentMethods.map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => setSelectedPaymentMethod(method.id.toString())}
                                    className={`p-4 rounded-[20px] border transition-all text-xs font-black uppercase flex items-center justify-center gap-3 ${
                                        selectedPaymentMethod === method.id.toString()
                                        ? 'bg-black text-white border-black shadow-lg scale-[1.02]'
                                        : 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-black/20'
                                    }`}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: method.hexColor }}></div>
                                    {method.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-zinc-100 my-4"></div>

                    {/* Price Breakdown */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-zinc-400 text-xs font-black uppercase tracking-widest">
                            <span>Precio de Lista</span>
                            <span>${selectedBooking.price}</span>
                        </div>
                        {userMembership && (
                            <div className="flex justify-between items-center text-emerald-500 text-xs font-black uppercase tracking-widest">
                                <span>Descuento ({userMembership.discount}%)</span>
                                <span>-${(selectedBooking.price * userMembership.discount / 100).toFixed(2)}</span>
                            </div>
                        )}
                        {selectedBooking.depositPaid > 0 && (
                            <div className="flex justify-between items-center text-blue-500 text-xs font-black uppercase tracking-widest">
                                <span>Pagado (Seña)</span>
                                <span>-${selectedBooking.depositPaid}</span>
                            </div>
                        )}
                        <div className="h-px bg-zinc-100 my-4"></div>
                        <div className="flex justify-between items-end">
                            <span className="text-zinc-900 text-sm font-black uppercase tracking-widest mb-1">Saldo a Cobrar</span>
                            <span className="text-4xl font-black italic text-black">
                                ${Math.max(0, (userMembership 
                                    ? (selectedBooking.price * (1 - userMembership.discount / 100))
                                    : selectedBooking.price) - selectedBooking.depositPaid).toFixed(2)
                                }
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-6">
                        <div className="grid grid-cols-2 gap-4">
                            {parseISO(selectedBooking.startTime) > new Date() ? (
                                <button 
                                    onClick={() => {
                                        handleCancelBooking(selectedBooking.id);
                                        setIsDetailsModalOpen(false);
                                    }}
                                    className="py-6 bg-rose-50 text-rose-500 rounded-[28px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-5 h-5" /> Anular Turno
                                </button>
                            ) : (
                                <div className="py-6 bg-zinc-100 text-zinc-400 rounded-[28px] font-black uppercase tracking-[0.1em] text-[9px] text-center flex items-center justify-center px-4 leading-tight">
                                    Turno en curso/pasado
                                </div>
                            )}
                            <button 
                                onClick={handleConfirmPayment}
                                disabled={!selectedPaymentMethod}
                                className="py-6 bg-emerald-500 text-white rounded-[28px] font-black uppercase tracking-widest shadow-2lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                            >
                                <DollarSign className="w-5 h-5" /> Cobrar Saldo
                            </button>
                        </div>

                        {selectedBooking.recurrenceGroupId && (
                            <button 
                                onClick={() => handleCancelSeries(selectedBooking.recurrenceGroupId!)}
                                className={`w-full py-4 rounded-[24px] font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 border-2 ${
                                    isConfirmingSeriesCancel 
                                    ? 'bg-rose-500 text-white border-rose-500 animate-pulse' 
                                    : 'border-zinc-200 text-zinc-400 hover:border-rose-200 hover:text-rose-500'
                                }`}
                            >
                                {isConfirmingSeriesCancel ? (
                                    <>¡CONFIRMAR ANULACIÓN DE SERIE!</>
                                ) : (
                                    <><X className="w-4 h-4" /> Anular toda la serie recurrente</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
