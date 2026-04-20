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
  subMonths,
  addMinutes
} from 'date-fns';
import { es } from 'date-fns/locale/es';
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
  ArrowLeft,
  Phone,
  Mail,
  AlertCircle
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
  user?: { fullName: string, phoneNumber?: string };
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
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

const BookingsPage = () => {
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [courts, setCourts] = useState<Court[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [spaceBookings, setSpaceBookings] = useState<SpaceBooking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ resource: { type: 'court' | 'space', data: Court | Space }, hour: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedSpaceBooking, setSelectedSpaceBooking] = useState<SpaceBooking | null>(null);
  const [userMembership, setUserMembership] = useState<{ name: string, discount: number } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  
  // Form states
  const [bookingType, setBookingType] = useState<'existing' | 'guest'>('existing');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestDni, setGuestDni] = useState('');
  const [duration, setDuration] = useState(60);
  const [isFree, setIsFree] = useState(false);
  const [searchClient, setSearchClient] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);

  const canCancel = (booking: any) => {
    if (!booking) return false;
    try {
        return parseISO(booking.startTime) > new Date();
    } catch {
        return false;
    }
  };

  const hasActiveMembership = (booking: any) => {
    return booking?.user?.userMemberships?.some((um: any) => um.isActive);
  };

  const [endDate, setEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [depositPaid, setDepositPaid] = useState<number>(0);
  const [openHour, setOpenHour] = useState(8);
  const [closeHour, setCloseHour] = useState(23);
  const [openHourForIndicator, setOpenHourForIndicator] = useState(8);
  const [selectedClientMembership, setSelectedClientMembership] = useState<{ name: string, discount: number } | null>(null);
  
  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]').map((r: string) => r.toLowerCase());
  const isAdmin = roles.includes('admin') || roles.includes('staff');
  
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
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Peticiones en paralelo con manejo de errores individual
      const pCourts = api.get('/api/courts', config).then(r => r.data).catch(() => []);
      const pSpaces = api.get('/api/spaces', config).then(r => r.data).catch(() => []);
      const pBookings = api.get(`/api/bookings/by-date?date=${dateStr}`, config).then(r => r.data).catch(() => []);
      const pSpaceBookings = api.get(`/api/spacebookings/by-date?date=${dateStr}`, config).then(r => r.data).catch(() => []);
      const pUsers = api.get('/api/users', config).then(r => r.data).catch(() => []);
      const pPayments = api.get('/api/PaymentMethods', config).then(r => r.data).catch(() => []);
      const pSettings = api.get('/api/SystemSettings', config).then(r => r.data).catch(() => []);

      const [resC, resS, resB, resSB, resU, resP, resSett] = await Promise.all([
        pCourts, pSpaces, pBookings, pSpaceBookings, pUsers, pPayments, pSettings
      ]);

      setCourts(resC || []);
      setSpaces((resS || []).filter((s: any) => s.isActive));
      setBookings(resB || []);
      setSpaceBookings(resSB || []);
      setClients(resU || []);
      setPaymentMethods((resP || []).filter((m: any) => m.isActive));
      
      const openH = parseInt(resSett?.find((s: any) => s.key === 'OpenHour')?.value || '8');
      const closeH = parseInt(resSett?.find((s: any) => s.key === 'CloseHour')?.value || '23');
      setOpenHour(openH);
      setCloseHour(closeH);
      setOpenHourForIndicator(openH);

      const generatedHours = [];
      for (let h = openH; h < closeH; h++) {
        generatedHours.push(h);
      }
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

  // Helper para parsear fechas de forma segura evitando desfases de zona horaria
  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    // Si la cadena ya incluye información de zona horaria (Z o +/-), usamos parseISO estándar
    if (dateStr.includes('Z') || dateStr.includes('+') || (dateStr.split('T')[1] && dateStr.split('T')[1].includes('-'))) {
      return parseISO(dateStr);
    }
    // Si es una fecha ISO local (sin TZ), la parseamos manualmente para asegurar que sea tratada como local
    // reemplazando T por espacio y - por / para compatibilidad multiplataforma
    return new Date(dateStr.replace('T', ' ').replace(/-/g, '/'));
  };

  const getBookingFor = (courtId: number, hour: number) => {
    return bookings.find(b => {
      const start = parseSafeDate(b.startTime);
      const end = parseSafeDate(b.endTime);
      
      const slotStart = new Date(selectedDate);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(selectedDate);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      const overlaps = start < slotEnd && end > slotStart;
      
      return b.courtId === courtId && overlaps && b.status !== 2;
    });
  };

  const getSpaceBookingFor = (spaceId: number, hour: number) => {
    return spaceBookings.find(b => {
      const start = parseSafeDate(b.startTime);
      const end = parseSafeDate(b.endTime);
      
      const slotStart = new Date(selectedDate);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(selectedDate);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      const overlaps = start < slotEnd && end > slotStart;
      
      return b.spaceId === spaceId && overlaps && b.status !== 2;
    });
  };

  const getBookingsCountForDay = (day: Date) => {
    return bookings.filter(b => isSameDay(parseISO(b.startTime), day) && b.status !== 2).length;
  };

  const handleOpenBooking = async (resource: Court | Space, type: 'court' | 'space', hour: number) => {
    if (type === 'court') {
      const existing = getBookingFor(resource.id, hour);
      if (existing) {
        setSelectedBooking(existing);
        setSelectedSpaceBooking(null);
        setIsDetailsModalOpen(true);
        
        if (existing.userId) {
          try {
            const res = await api.get(`/api/membership/user/${existing.userId}`, config);
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
    } else {
      const existing = getSpaceBookingFor(resource.id, hour);
      if (existing) {
        setSelectedSpaceBooking(existing);
        setSelectedBooking(null);
        setIsDetailsModalOpen(true);
        setUserMembership(null);
        return;
      }
    }

    // Resetear duración por defecto según el tipo de recurso
    setDuration(type === 'space' ? 120 : 60);
    setSelectedTimeSlot({ resource: { type, data: resource }, hour });
    setIsModalOpen(true);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimeSlot) return;

    if (bookingType === 'guest' && (!guestName || !guestDni || !guestPhone)) {
        alert('Nombre, DNI y Teléfono son obligatorios para clientes particulares');
        return;
    }

    const startDate = new Date(selectedDate);
    startDate.setHours(selectedTimeSlot.hour, 0, 0, 0);
    
    // Usamos formato ISO local sin offset para evitar que el servidor haga conversiones de zona horaria
    const startTimeStr = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
    const endDate = addMinutes(startDate, duration);
    const endTimeStr = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");
    
    // Alerta de cruce de día: solo si termina después de las 00:00:00 del día siguiente
    const startObj = new Date(startTimeStr);
    const endObj = new Date(startObj.getTime() + duration * 60000);
    
    // Si termina exactamente a las 00:00 (medianoche), no consideramos que cruza de día para el usuario
    const isActuallyNextDay = endObj.getDate() !== startObj.getDate() && (endObj.getHours() > 0 || endObj.getMinutes() > 0);
    
    if (isActuallyNextDay) {
        if (!window.confirm(`ATENCIÓN: Esta reserva termina el día siguiente (${format(endObj, 'dd/MM HH:mm')} hs). ¿Deseas continuar?`)) {
            setLoading(false);
            return;
        }
    }

    try {
      if (selectedTimeSlot.resource.type === 'court') {
        const payload = {
          courtId: selectedTimeSlot.resource.data.id,
          guestName: bookingType === 'guest' ? guestName : null,
          guestPhone: bookingType === 'guest' ? guestPhone : null,
          guestEmail: bookingType === 'guest' ? guestEmail : null,
          dni: bookingType === 'guest' ? guestDni : null,
          userId: bookingType === 'existing' ? selectedClientId : null,
          startTime: startTimeStr,
          durationMinutes: duration,
          isRecurring: isRecurring,
          endDate: isRecurring ? endDate : null,
          price: isFree ? 0 : ((duration / 60) * (selectedTimeSlot.resource.data as Court).pricePerHour),
          depositPaid: depositPaid
        };
        await api.post('/api/bookings/admin-create', payload, config);
      } else {
        const spaceBookingData = {
          spaceId: (selectedTimeSlot.resource.data as Space).id,
          guestName: bookingType === 'guest' ? guestName : null,
          guestPhone: guestPhone,
          guestEmail: guestEmail,
          dni: guestDni,
          userId: bookingType === 'existing' ? selectedClientId : null,
          startTime: startTimeStr,
          endTime: endTimeStr,
          durationMinutes: duration,
          price: isFree ? 0 : (selectedTimeSlot.resource.data as Space).pricePerSlot,
          depositPaid: depositPaid,
          status: 1
        };
        await api.post('/api/spacebookings/admin-create', spaceBookingData, config);
      }
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

  const handleCancelBooking = async (bookingOverride?: Booking | SpaceBooking) => {
    const booking = bookingOverride || selectedBooking || selectedSpaceBooking;
    if (!booking) return;

    if (window.confirm('¿Liberar este turno?')) {
      try {
        const isSpace = 'spaceId' in booking;
        const url = isSpace ? `/api/spacebookings/${booking.id}` : `/api/bookings/${booking.id}`;
        await api.delete(url, config);
        setIsDetailsModalOpen(false);
        resetForm();
        fetchData();
      } catch (err) {
        console.error("Error al cancelar", err);
      }
    }
  };

  const resetForm = () => {
    setSearchClient('');
    setSelectedClientId('');
    setGuestName('');
    setGuestPhone('');
    setGuestEmail('');
    setGuestDni('');
    setDuration(60);
    setIsFree(false);
    setIsRecurring(false);
    setDepositPaid(0);
    setSelectedBooking(null);
    setSelectedSpaceBooking(null);
    setSelectedPaymentMethod('');
    setUserMembership(null);
    setSelectedClientMembership(null);
    setIsConfirmingSeriesCancel(false);
  };

  const handleConfirmPayment = async () => {
    const booking = selectedBooking || selectedSpaceBooking;
    const isSpace = !!selectedSpaceBooking;
    
    if (!booking || !selectedPaymentMethod) {
        alert("Por favor seleccione un medio de pago");
        return;
    }

    try {
        setLoading(true);
        
        // Calcular el saldo pendiente real considerando el descuento de membresía si aplica
        let finalPrice = booking.price;
        if (userMembership) {
            // Ya aplicamos descuento visualmente, pero aquí necesitamos el monto final que se cargó
            // Si el backend ya aplicó el descuento (que ahora lo hace), booking.price ya es el valor neto.
            finalPrice = booking.price;
        }

        const pendingAmount = Math.max(0, finalPrice - booking.depositPaid);
        
        const method = paymentMethods.find(m => m.id.toString() === selectedPaymentMethod);
        const description = (method?.name === "BONIFICADO / SIN COSTO") 
            ? `Bonificación de Alquiler: ${isSpace ? (booking as SpaceBooking).space.name : (booking as Booking).court.name}`
            : `Pago de Alquiler (${method?.name}): ${isSpace ? (booking as SpaceBooking).space.name : (booking as Booking).court.name}`;

        if (pendingAmount > 0) {
            if (!booking.userId) {
                // Para invitados (particular), no registramos movimiento en Cta Cte
                console.log("Pago de invitado recibido - no se genera movimiento en Cta Cte");
            } else {
                await api.post(`/api/transaction/payment?userId=${booking.userId}&amount=${pendingAmount}&description=${description}&paymentMethodId=${selectedPaymentMethod}`, {}, config);
            }
        }

        // 2. IMPORTANTE: Marcar la reserva como pagada (DepositPaid = Price) para que el UI muestre el punto verde
        const payUrl = isSpace ? `/api/spacebookings/${booking.id}/pay` : `/api/bookings/${booking.id}/pay`;
        await api.post(payUrl, {}, config);

        setIsDetailsModalOpen(false);
        resetForm();
        fetchData();
        alert(method?.name === "BONIFICADO / SIN COSTO" ? "Reserva bonificada correctamente" : "Pago registrado con éxito");
    } catch (err: any) {
        console.error("Error al procesar pago", err);
        alert("Error al registrar el pago: " + (err.response?.data?.message || err.message));
    } finally {
        setLoading(false);
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

            {/* Admin Resource Shortcuts */}
            {isAdmin && (
              <div className="flex gap-2">
                <a 
                  href="/courts" 
                  className="px-5 py-3.5 bg-white border border-black/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-black hover:bg-zinc-50 transition-all shadow-sm flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Gestionar Canchas
                </a>
                <a 
                  href="/manage-spaces" 
                  className="px-5 py-3.5 bg-white border border-black/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-black hover:bg-zinc-50 transition-all shadow-sm flex items-center gap-2"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-amber-600" /> Gestionar Unidades
                </a>
              </div>
            )}
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
                        {/* Time Indicator Line - Forzado a hora local absoluta */}
                        {isSameDay(currentTime, selectedDate) && (
                            <div 
                                className="absolute left-0 right-0 z-40 flex items-center pointer-events-none transition-all duration-1000"
                                style={{ 
                                    // Obtenemos la hora local real sin desfases de zona horaria
                                    top: `calc(72px + ${(new Date().getHours() - openHourForIndicator) * 100}px + ${(new Date().getMinutes() / 60) * 100}px)` 
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
                        <div 
                          className="grid border-b-2 border-zinc-200 bg-white sticky top-0 z-30"
                          style={{ gridTemplateColumns: `120px repeat(${(courts?.length || 0) + (spaces?.length || 0)}, minmax(200px, 1fr))` }}
                        >
                            <div className="p-4 bg-zinc-200/50 border-r-2 border-zinc-300 flex items-center justify-center font-black text-[10px] text-zinc-400">
                                RELOJ
                            </div>
                            {courts.map((court, idx) => (
                                <div key={`court-head-${court.id}`} className={`p-4 text-center border-r-2 border-zinc-100 ${idx % 2 !== 0 ? 'bg-zinc-100/50' : 'bg-white'}`}>
                                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Cancha Padel</p>
                                    <h3 className="text-sm font-black uppercase italic tracking-wider text-black">{court.name}</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">${court.pricePerHour}/H</p>
                                </div>
                            ))}
                            {spaces.map((space, idx) => (
                                <div key={`space-head-${space.id}`} className={`p-4 text-center border-r-2 border-zinc-100 bg-amber-50/50`}>
                                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">Espacio Común</p>
                                    <h3 className="text-sm font-black uppercase italic tracking-wider text-amber-900">{space.name}</h3>
                                    <p className="text-[10px] text-amber-600/60 font-bold uppercase tracking-widest mt-0.5">${space.pricePerSlot}/FIJO</p>
                                </div>
                            ))}
                        </div>

                        {/* Matrix */}
                        {hours.map(hour => (
                            <div 
                                key={hour} 
                                id={`hour-${hour}`} 
                                className="grid group border-l border-zinc-200"
                                style={{ 
                                    gridTemplateColumns: `120px repeat(${(courts?.length || 0) + (spaces?.length || 0)}, minmax(200px, 1fr))` 
                                }}
                            >
                                <div className={`p-4 border-r-2 border-b border-zinc-200 flex flex-col items-center justify-center transition-all ${
                                    (courts.some(c => getBookingFor(c.id, hour)) || spaces.some(s => getSpaceBookingFor(s.id, hour)))
                                    ? 'bg-black text-white' 
                                    : 'bg-zinc-200/20 text-zinc-800 group-hover:bg-black group-hover:text-white'
                                }`}>
                                    <span className="font-black italic text-sm leading-none">{hour.toString().padStart(2, '0')}:00</span>
                                    <span className={`text-[8px] font-bold uppercase tracking-widest mt-1.5 opacity-50`}>
                                        ➔ {(hour + 1).toString().padStart(2, '0')}:00
                                    </span>
                                </div>
                                {courts.map((court, idx) => {
                                    const booking = getBookingFor(court.id, hour);
                                    const isStartHour = booking && parseSafeDate(booking.startTime).getHours() === hour;

                                    const palette = [
                                        'from-indigo-600 via-indigo-700 to-violet-800 shadow-indigo-500/40',
                                        'from-emerald-700 via-emerald-800 to-teal-900 shadow-emerald-500/40',
                                        'from-amber-600 via-orange-700 to-rose-700 shadow-orange-500/40',
                                        'from-cyan-700 via-blue-800 to-indigo-900 shadow-blue-500/40',
                                        'from-rose-700 via-pink-800 to-fuchsia-900 shadow-rose-500/40'
                                    ];
                                    const isParticular = !hasActiveMembership(booking);
                                    const colorClass = booking ? (isParticular ? 'from-zinc-800 to-black shadow-zinc-950/50' : palette[booking.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % palette.length]) : '';

                                    const start = booking ? parseSafeDate(booking.startTime) : null;
                                    const end = booking ? parseSafeDate(booking.endTime) : null;
                                    const dur = (start && end) ? Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60)) : 1;
                                    const topOffset = start ? (start.getMinutes() / 60) * 100 : 0;

                                    return (
                                        <div 
                                            key={`court-${court.id}-${hour}`}
                                            className={`border-b border-r-2 border-zinc-200/50 p-2 min-h-[100px] relative hover:bg-zinc-200/30 transition-all cursor-pointer group/cell ${idx % 2 !== 0 ? 'bg-zinc-100/40' : 'bg-white'} ${isStartHour ? 'z-40' : 'z-0'}`}
                                            onClick={() => handleOpenBooking(court, 'court', hour)}
                                        >
                                            {booking ? (
                                                isStartHour && (
                                                    <div 
                                                        style={{ 
                                                            top: `calc(${topOffset}% + 8px)`, 
                                                            bottom: `calc(${(1 - (dur + topOffset/100)) * 100}% + 8px)` 
                                                        }}
                                                        className={`absolute inset-x-2 text-white rounded-2xl p-3 shadow-2xl flex flex-col justify-between overflow-hidden group/item transition-all hover:scale-[1.01] border border-white/10 z-30 bg-gradient-to-br ${colorClass}`}
                                                    >
                                                        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 rotate-12 pointer-events-none transition-transform group-hover/item:translate-x-full duration-1000"></div>

                                                        <div className="flex justify-between items-start relative z-10">
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase tracking-tighter text-white/50 mb-1">
                                                                    {hasActiveMembership(booking) ? 'MEMBRESÍA ACTIVA' : 'CLIENTE PARTICULAR'}
                                                                </p>
                                                                <p className="text-xs font-black uppercase italic leading-tight truncate max-w-[140px]">
                                                                    {booking.user?.fullName || booking.guestName || "SIN NOMBRE"}
                                                                    <span className="ml-1.5 text-[9px] font-bold text-white/60 not-italic">
                                                                        ({booking.guestPhone || booking.user?.phoneNumber || 'S/T'})
                                                                    </span>
                                                                </p>
                                                            </div>
                                                            {booking.depositPaid < booking.price && (
                                                                <button 
                                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCancelBooking(booking); }}
                                                                    className="p-1.5 bg-white/10 hover:bg-rose-600 rounded-lg transition-colors border border-white/5"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex flex-col gap-1 relative z-10 flex-1 justify-center">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${booking.depositPaid >= booking.price ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]'}`}></div>
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                                                                        {booking.depositPaid >= booking.price ? 'PAGADO' : 'PENDIENTE'}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-black italic text-white/90 bg-black/20 px-2 py-0.5 rounded-lg">
                                                                    {format(parseSafeDate(booking.startTime), 'HH:mm')} - {format(parseSafeDate(booking.endTime), 'HH:mm')}
                                                                </span>
                                                            </div>

                                                             {!booking.userId && booking.guestEmail && (
                                                                 <div className="flex flex-col gap-0.5 mt-1 border-t border-white/10 pt-1">
                                                                     <p className="text-[8px] font-bold text-white/80 flex items-center gap-1 truncate"><Mail className="w-2 h-2" /> {booking.guestEmail}</p>
                                                                 </div>
                                                             )}

                                                             {booking.depositPaid > 0 && booking.depositPaid < booking.price && (
                                                                <p className="text-[8px] font-black text-amber-300 uppercase tracking-widest mt-1">
                                                                    Seña: ${booking.depositPaid}
                                                                </p>
                                                             )}
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
                                {spaces.map((space, idx) => {
                                    const booking = getSpaceBookingFor(space.id, hour);
                                    const isStartHour = booking && parseSafeDate(booking.startTime).getHours() === hour;

                                    const start = booking ? parseSafeDate(booking.startTime) : null;
                                    const end = booking ? parseSafeDate(booking.endTime) : null;
                                    const dur = (start && end) ? Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60)) : 1;
                                    const topOffset = start ? (start.getMinutes() / 60) * 100 : 0;

                                    return (
                                        <div 
                                            key={`space-${space.id}-${hour}`}
                                            className={`border-b border-r-2 border-zinc-200/50 p-2 min-h-[75px] relative hover:bg-amber-100/50 transition-all cursor-pointer group/cell bg-amber-50/20 ${isStartHour ? 'z-40' : 'z-0'}`}
                                            onClick={() => handleOpenBooking(space, 'space', hour)}
                                        >
                                            {booking ? (
                                                isStartHour && (
                                                    <div 
                                                        style={{ 
                                                            top: `calc(${topOffset}% + 8px)`, 
                                                            bottom: `calc(${(1 - (dur + topOffset/100)) * 100}% + 8px)` 
                                                        }}
                                                        className={`absolute inset-x-2 text-white rounded-2xl p-3 shadow-2xl flex flex-col justify-between overflow-hidden group/item transition-all hover:scale-[1.01] border border-white/10 z-30 bg-black shadow-zinc-950/40`}
                                                    >
                                                        <div className="flex justify-between items-start relative z-10">
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase tracking-tighter text-amber-100/50 mb-1">
                                                                    {hasActiveMembership(booking) ? 'MEMBRESÍA ACTIVA' : 'CLIENTE PARTICULAR'}
                                                                </p>
                                                                <p className="text-xs font-black uppercase italic leading-tight truncate max-w-[140px]">
                                                                    {booking.user?.fullName || booking.guestName || "SIN NOMBRE"}
                                                                </p>
                                                                <p className="text-[9px] font-bold text-amber-100/60 mt-0.5">
                                                                    {booking.guestPhone || 'S/T'}
                                                                </p>
                                                            </div>
                                                            {booking.depositPaid < booking.price && (
                                                                <button 
                                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCancelBooking(booking); }}
                                                                    className="p-1.5 bg-white/10 hover:bg-rose-600 rounded-lg transition-colors"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex flex-col gap-1 relative z-10 flex-1 justify-center">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${booking.depositPaid >= booking.price ? 'bg-emerald-400' : 'bg-orange-400'}`}></div>
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-50/70">
                                                                        {booking.depositPaid >= booking.price ? 'PAGADO' : 'SEÑA'}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[9px] font-black italic text-white/90 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">
                                                                    {format(parseSafeDate(booking.startTime), 'HH:mm')} - {format(parseSafeDate(booking.endTime), 'HH:mm')}
                                                                </span>
                                                            </div>
                                                         </div>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <div className="p-3 bg-amber-100 rounded-2xl">
                                                        <Plus className="w-4 h-4 text-amber-400" />
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
                        <span className="text-[7px] font-black uppercase tracking-widest text-white/30">
                            {selectedTimeSlot.resource.type === 'court' ? 'Cancha' : 'Espacio'}: {selectedTimeSlot.resource.data.name}
                        </span>
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
                                            onClick={async () => {
                                                setSelectedClientId(client.id);
                                                setSearchClient(client.fullName);
                                                // Consultar membresía del cliente seleccionado en tiempo real
                                                try {
                                                    const res = await api.get(`/api/memberships/user/${client.id}`, config);
                                                    if (res.data && res.data.membership) {
                                                        setSelectedClientMembership({
                                                            name: res.data.membership.name,
                                                            discount: res.data.membership.discountPercentage
                                                        });
                                                    } else {
                                                        setSelectedClientMembership(null);
                                                    }
                                                } catch (e) {
                                                    setSelectedClientMembership(null);
                                                }
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nombre Completo *</label>
                                    <input 
                                        type="text"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300"
                                        placeholder="Ej: Juan Perez"
                                        required
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">DNI (Único) *</label>
                                    <input 
                                        type="text"
                                        value={guestDni}
                                        onChange={(e) => setGuestDni(e.target.value)}
                                        className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300"
                                        placeholder="Solo números"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Teléfono *</label>
                                    <input 
                                        type="tel"
                                        value={guestPhone}
                                        onChange={(e) => setGuestPhone(e.target.value)}
                                        className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300"
                                        placeholder="Ej: 381..."
                                        required
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Email (Opcional)</label>
                                    <input 
                                        type="email"
                                        value={guestEmail}
                                        onChange={(e) => setGuestEmail(e.target.value)}
                                        className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300"
                                        placeholder="nombre@ejemplo.com"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedTimeSlot.resource.type === 'space' && (
                        <div className="pt-2">
                            <label className="flex items-center gap-4 p-4 bg-zinc-50 rounded-[20px] border border-zinc-100 cursor-pointer hover:bg-zinc-100 transition-all group">
                                <input 
                                    type="checkbox" 
                                    checked={isFree}
                                    onChange={(e) => setIsFree(e.target.checked)}
                                    className="w-6 h-6 rounded-lg accent-emerald-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isFree ? 'text-emerald-600' : 'text-zinc-600'}`}>Reserva sin cargo (Gratis)</p>
                                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">No registrará deuda en Cuenta Corriente</p>
                                </div>
                                {isFree && (
                                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500 rounded-full animate-in zoom-in duration-300">
                                        <span className="text-[8px] font-black text-black">BONIFICADO</span>
                                    </div>
                                )}
                            </label>
                        </div>
                    )}

                    <div className="h-px bg-zinc-100 my-4"></div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Duración</label>
                                    <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl overflow-x-auto scrollbar-hide">
                                        {(selectedTimeSlot.resource.type === 'court' ? [60, 120, 180] : [60, 120, 180, 240, 360, 480]).map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDuration(d)}
                                                className={`flex-shrink-0 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                                                    duration === d 
                                                    ? 'bg-white text-black shadow-sm' 
                                                    : 'text-zinc-400 hover:bg-zinc-50'
                                                }`}
                                            >
                                                {d === 60 ? '1 HORA' : `${d/60} HORAS`}
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
                            className="flex-2 py-6 bg-black text-white rounded-[28px] font-black uppercase tracking-widest shadow-2xl shadow-black/20 hover:bg-zinc-800 transition-all flex flex-col items-center justify-center gap-0.5"
                        >
                            <div className="flex items-center gap-2">
                                <Check className="w-5 h-5" /> <span>Confirmar Reserva</span>
                            </div>
                            {bookingType === 'existing' && selectedClientId && (
                                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                                    {selectedClientMembership 
                                        ? `Beneficio ${selectedClientMembership.name} (${selectedClientMembership.discount}%): $${(
                                            selectedTimeSlot.resource.type === 'court' 
                                            ? ((duration / 60) * (selectedTimeSlot.resource.data as Court).pricePerHour * (1 - selectedClientMembership.discount / 100))
                                            : ((selectedTimeSlot.resource.data as Space).pricePerSlot * (1 - selectedClientMembership.discount / 100))
                                          ).toFixed(2)}`
                                        : `Total Cliente (S/M): $${(
                                            selectedTimeSlot.resource.type === 'court'
                                            ? ((duration / 60) * (selectedTimeSlot.resource.data as Court).pricePerHour)
                                            : (selectedTimeSlot.resource.data as Space).pricePerSlot
                                          ).toFixed(2)}`
                                    }
                                </span>
                            )}
                            {bookingType === 'guest' && (
                                <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
                                    Total: ${ (
                                        selectedTimeSlot.resource.type === 'court'
                                        ? ((duration / 60) * (selectedTimeSlot.resource.data as Court).pricePerHour)
                                        : (selectedTimeSlot.resource.data as Space).pricePerSlot
                                    ).toFixed(2)}
                                </span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isDetailsModalOpen && (selectedBooking || selectedSpaceBooking) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 border border-black/5">
                <div className="p-7 bg-gradient-to-br from-zinc-800 to-black text-white relative">
                    <button onClick={() => { setIsDetailsModalOpen(false); resetForm(); }} className="absolute right-6 top-6 p-2.5 hover:bg-white/10 rounded-2xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Checkout de Alquiler</span>
                    </div>
                    <div className="mt-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Cliente responsable</p>
                        <h2 className="text-3xl font-black italic uppercase tracking-tight leading-none text-white">
                            {(selectedBooking || selectedSpaceBooking)?.user?.fullName || (selectedBooking || selectedSpaceBooking)?.guestName || "SIN NOMBRE CARGADO"}
                        </h2>
                    </div>
                    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mt-3 bg-emerald-500/10 w-fit px-3 py-1 rounded-full border border-emerald-500/20">
                        {selectedBooking ? selectedBooking.court.name : selectedSpaceBooking?.space.name} 
                        <span className="mx-2 opacity-50">•</span> 
                        {format(parseISO((selectedBooking || selectedSpaceBooking)!.startTime), 'HH:mm')} A {format(parseISO((selectedBooking || selectedSpaceBooking)!.endTime), 'HH:mm')} HS
                    </p>
                </div>

                <div className="p-7 space-y-6">
                    {/* Membership Info Alert Compacta Refinada */}
                    {userMembership ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-[24px] flex items-center gap-3 animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white scale-90">
                                <Check className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest leading-none mb-1">¡Beneficio Socio Black Detectado!</p>
                                <p className="text-xs font-black text-emerald-900 uppercase italic">{userMembership.name} (-{userMembership.discount}%)</p>
                            </div>
                        </div>
                    ) : (selectedBooking || selectedSpaceBooking)?.userId ? (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-[24px] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 scale-90">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-amber-600 tracking-widest leading-none mb-1">Membresía Pendiente de Pago</p>
                                <p className="text-xs font-black text-amber-900 uppercase italic">Regularizar cuota en Cuenta Corriente para activar beneficio.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-[24px] flex items-center gap-3 grayscale opacity-60">
                            <div className="w-10 h-10 rounded-full bg-zinc-300 flex items-center justify-center text-white scale-90">
                                <X className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">Carga como Particular (Invitado)</p>
                                <p className="text-xs font-black text-zinc-600 uppercase italic">Sin cuenta de socio vinculada</p>
                            </div>
                        </div>
                    )}

                    {/* Payment Method Selector */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block italic">Seleccionar Medio de Pago</label>
                        <div className="grid grid-cols-2 gap-4">
                            {paymentMethods
                                .filter(m => (selectedBooking ? m.name !== "BONIFICADO / SIN COSTO" : true))
                                .map(method => (
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

                    {/* Price Breakdown Detallado - Calculado dinámicamente para evitar doble descuento visual */}
                    {(() => {
                        const booking = selectedBooking || selectedSpaceBooking;
                        if (!booking) return null;
                        
                        let basePriceForDisplay = booking.price; // Fallback
                        
                        if (selectedBooking) {
                            const court = courts.find(c => c.id === selectedBooking.courtId);
                            if (court) {
                                const start = parseISO(selectedBooking.startTime);
                                const end = parseISO(selectedBooking.endTime);
                                const durHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                basePriceForDisplay = durHours * court.pricePerHour;
                            }
                        } else if (selectedSpaceBooking) {
                            const space = spaces.find(s => s.id === selectedSpaceBooking.spaceId);
                            if (space) {
                                basePriceForDisplay = space.pricePerSlot;
                            }
                        }

                        // Si el precio base calculado es menor que el de la reserva (ej: subió el precio después), 
                        // usamos el de la reserva como base para no mostrar descuentos negativos
                        if (basePriceForDisplay < booking.price) basePriceForDisplay = booking.price;

                        const discountAmount = userMembership ? (basePriceForDisplay * userMembership.discount / 100) : 0;

                        return (
                            <div className="space-y-4 bg-zinc-50 p-8 rounded-[32px] border border-zinc-100">
                                <div className="flex justify-between items-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                                    <span>Precio de Lista (Base)</span>
                                    <span className="font-outfit text-zinc-600">${basePriceForDisplay.toLocaleString()}</span>
                                </div>
                                
                                {userMembership && (
                                    <div className="flex justify-between items-center text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                            <span>Beneficio Membresía ({userMembership.name})</span>
                                        </div>
                                        <span className="font-outfit">-{userMembership.discount}% (-${discountAmount.toLocaleString()})</span>
                                    </div>
                                )}

                                <div className="h-px bg-zinc-200/50 my-2"></div>

                                <div className="flex justify-between items-center text-black text-[10px] font-black uppercase tracking-widest">
                                    <span>Subtotal Final</span>
                                    <span className="font-outfit text-lg">
                                        ${booking.price.toLocaleString()}
                                    </span>
                                </div>

                                {booking.depositPaid > 0 && (
                                    <div className="flex justify-between items-center text-blue-600 text-[10px] font-black uppercase tracking-widest pt-1">
                                        <span>Abonado (Seña registrada)</span>
                                        <span className="font-bold">-${booking.depositPaid.toLocaleString()}</span>
                                    </div>
                                )}

                                <div className="mt-6 pt-6 border-t-2 border-black/5 flex justify-between items-end">
                                    <div>
                                        <p className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">TOTAL A COBRAR</p>
                                        <p className="text-xs text-zinc-400 font-bold uppercase">Saldo Neto Final</p>
                                    </div>
                                    <span className="text-4xl font-black italic text-black tracking-tighter">
                                        ${Math.max(0, booking.price - booking.depositPaid).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-6">
                        <div className="grid grid-cols-2 gap-4">
                            {parseISO((selectedBooking || selectedSpaceBooking)!.startTime) > new Date() ? (
                                (selectedBooking || selectedSpaceBooking)!.depositPaid < (selectedBooking || selectedSpaceBooking)!.price && canCancel(selectedBooking || selectedSpaceBooking) ? (
                                    <button 
                                        onClick={() => handleCancelBooking()}
                                        className="py-6 bg-rose-50 text-rose-500 rounded-[28px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-5 h-5" /> Anular Turno
                                    </button>
                                ) : (selectedBooking || selectedSpaceBooking)!.depositPaid >= (selectedBooking || selectedSpaceBooking)!.price ? (
                                    <div className="py-6 bg-emerald-50 text-emerald-600 rounded-[28px] font-black uppercase tracking-[0.1em] text-[9px] text-center flex items-center justify-center px-4 leading-tight italic">
                                        Turno Pagado (No anulable)
                                    </div>
                                ) : (
                                    <div className="py-6 bg-zinc-100 text-zinc-400 rounded-[28px] font-black uppercase tracking-[0.1em] text-[9px] text-center flex items-center justify-center px-4 leading-tight">
                                        Turno en curso/pasado
                                    </div>
                                )
                            ) : (
                                <div className="py-6 bg-zinc-100 text-zinc-400 rounded-[28px] font-black uppercase tracking-[0.1em] text-[9px] text-center flex items-center justify-center px-4 leading-tight">
                                    Turno en curso/pasado
                                </div>
                            )}
                            <button 
                                onClick={handleConfirmPayment}
                                disabled={!selectedPaymentMethod || (selectedBooking || selectedSpaceBooking)!.depositPaid >= (selectedBooking || selectedSpaceBooking)!.price}
                                className={`py-6 rounded-[28px] font-black uppercase tracking-widest shadow-2lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale ${
                                    (selectedBooking || selectedSpaceBooking)!.depositPaid >= (selectedBooking || selectedSpaceBooking)!.price
                                    ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed shadow-none'
                                    : 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                                }`}
                            >
                                {(selectedBooking || selectedSpaceBooking)!.depositPaid >= (selectedBooking || selectedSpaceBooking)!.price ? (
                                    <>PAGO COMPLETADO <Check className="w-5 h-5" /></>
                                ) : (
                                    <><DollarSign className="w-5 h-5" /> Cobrar Saldo</>
                                )}
                            </button>
                        </div>

                        {selectedBooking?.recurrenceGroupId && (
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
