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
    Box,
    Layout,
    MessageCircle,
    AlertCircle,
    Package,
    RefreshCw,
    Printer
} from 'lucide-react';
import Header from '../components/Header';

interface Court {
    id: number;
    name: string;
    pricePerHour: number;
}

interface Client {
    id: string;
    fullName: string;
    email: string;
    dni?: string;
    isActive?: boolean;
    role?: string;
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
    user?: { fullName: string; phoneNumber?: string };
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
    guestAddress?: string;
    status: number;
    price: number;
    depositPaid: number;
    bookingConsumptions?: any[];
}

interface Booking {
    id: string;
    startTime: string;
    endTime: string;
    courtId: number;
    court: { name: string };
    userId?: string;
    user?: { fullName: string; phoneNumber?: string };
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
    status: number;
    price: number;
    depositPaid: number;
    recurrenceGroupId?: string;
    bookingConsumptions?: any[];
}

interface Activity {
    id: number;
    name: string;
    instructorName: string;
    schedules: {
        id: number;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        courtId?: number | null;
        spaceId?: number | null;
    }[];
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
};

const getRentDebt = (booking: any) => Math.max(0, booking.price - booking.depositPaid);

const getConsumptionDebt = (booking: any) => {
    return (booking.bookingConsumptions || [])
        .filter((c: any) => !c.isPaid)
        .reduce((sum: number, c: any) => sum + (c.totalPrice || (c.unitPrice * c.quantity)), 0);
};

const getTotalDebt = (booking: any) => getRentDebt(booking) + getConsumptionDebt(booking);

const isFullyPaid = (booking: any) => getTotalDebt(booking) <= 0;

const BookingsPage = () => {
    const [view, setView] = useState<'daily' | 'monthly'>('daily');
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const [courts, setCourts] = useState<Court[]>([]);
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [spaceBookings, setSpaceBookings] = useState<SpaceBooking[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
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
    const [bookingConsumptions, setBookingConsumptions] = useState<any[]>([]);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [companyInfo, setCompanyInfo] = useState({
        name: 'PadelQ',
        address: '',
        phone: '',
        email: '',
        website: ''
    });
    const [isClosingCourt, setIsClosingCourt] = useState(false);
    const [rentFractionsCount, setRentFractionsCount] = useState(1);
    const [selectedRentFractions, setSelectedRentFractions] = useState<number[]>([]);
    const [selectedConsumptionsIds, setSelectedConsumptionsIds] = useState<string[]>([]);
    const [paymentObservation, setPaymentObservation] = useState('');
    // Form states
    const [bookingType, setBookingType] = useState<'existing' | 'guest'>('existing');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestDni, setGuestDni] = useState('');
    const [existingUser, setExistingUser] = useState<any | null>(null);
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
    const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

    const handleAddByBarcode = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && barcodeInput.trim()) {
            try {
                let products = allProducts;
                if (products.length === 0) {
                    const res = await api.get('/api/products', config);
                    products = res.data;
                    setAllProducts(products);
                }

                const product = products.find(p =>
                    (p.barcode && p.barcode.toLowerCase() === barcodeInput.trim().toLowerCase()) ||
                    (p.internalCode && p.internalCode.toLowerCase() === barcodeInput.trim().toLowerCase())
                );

                if (product) {
                    const booking = selectedBooking || selectedSpaceBooking;
                    if (!booking) return;

                    await api.post('/api/consumptions', {
                        bookingId: booking.id,
                        productId: product.id,
                        quantity: 1
                    }, config);

                    const consRes = await api.get(`/api/consumptions/booking/${booking.id}`, config);
                    setBookingConsumptions(consRes.data || []);
                    setBarcodeInput('');
                } else {
                    alert("Producto no encontrado");
                    setBarcodeInput('');
                }
            } catch (err: any) {
                console.error("Error barcode:", err);
                alert("Error al procesar código de barras");
            }
        }
    };

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
            const pActivities = api.get('/api/activities', config).then(r => r.data).catch(() => []);

            const [resC, resS, resB, resSB, resU, resP, resSett, resA] = await Promise.all([
                pCourts, pSpaces, pBookings, pSpaceBookings, pUsers, pPayments, pSettings, pActivities
            ]);

            setCourts(resC || []);
            setSpaces((resS || []).filter((s: any) => (s.isActive ?? s.IsActive) && (s.showInCalendar ?? s.ShowInCalendar ?? true)));
            setBookings(resB || []);
            setSpaceBookings(resSB || []);
            setClients(resU || []);
            setActivities(resA || []);
            setPaymentMethods((resP || []).filter((m: any) => m.isActive));

            if (resSett && Array.isArray(resSett)) {
                const info = { ...companyInfo };
                resSett.forEach((s: any) => {
                    if (s.key === 'CompanyName') info.name = s.value;
                    if (s.key === 'CompanyAddress') info.address = s.value;
                    if (s.key === 'CompanyPhone') info.phone = s.value;
                    if (s.key === 'CompanyEmail') info.email = s.value;
                    if (s.key === 'CompanyWebsite') info.website = s.value;
                });
                setCompanyInfo(info);

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
            }
        } catch (err) {
            console.error("Error al cargar datos", err);
        } finally {
            setLoading(false);
        }
    };

    const [hours, setHours] = useState<number[]>([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]);

    const filteredClients = useMemo(() => {
        if (!searchClient) return [];

        // REGLA: Excluir inactivos y perfiles administrativos/comercio
        const restrictedRoles = ['admin', 'administrador', 'administracion', 'comercio', 'staff'];

        return clients.filter(c => {
            // Validar estado activo
            if (c.isActive === false) return false;

            // Validar rol restringido
            const userRole = (c.role || '').toLowerCase();
            if (restrictedRoles.includes(userRole)) return false;

            return c.fullName.toLowerCase().includes(searchClient.toLowerCase()) ||
                c.email.toLowerCase().includes(searchClient.toLowerCase()) ||
                (c.dni && c.dni.includes(searchClient));
        }).slice(0, 5);
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

    const getActivityFor = (resourceId: number, type: 'court' | 'space', hour: number) => {
        if (!activities) return null;
        const dayOfWeek = selectedDate.getDay();

        for (const activity of activities) {
            const schedules = activity.schedules || (activity as any).Schedules;
            if (!schedules || !Array.isArray(schedules)) continue;

            for (const s of schedules) {
                const sDay = s.dayOfWeek ?? (s as any).DayOfWeek;

                if (Number(sDay) === dayOfWeek) {
                    const sCourtId = s.courtId ?? (s as any).CourtId;
                    const sSpaceId = s.spaceId ?? (s as any).SpaceId;

                    const matchesResource = type === 'court'
                        ? (sCourtId != null && Number(sCourtId) === resourceId)
                        : (sSpaceId != null && Number(sSpaceId) === resourceId);

                    if (matchesResource) {
                        const startStr = s.startTime || (s as any).StartTime;
                        if (startStr) {
                            const sHour = parseInt(startStr.split(':')[0]);
                            if (sHour === hour) {
                                return { activity, schedule: s };
                            }
                        }
                    }
                }
            }
        }
        return null;
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

                // Fetch consumptions
                try {
                    const consRes = await api.get(`/api/consumptions/booking/${existing.id}`, config);
                    setBookingConsumptions(consRes.data || []);
                } catch (e) {
                    setBookingConsumptions([]);
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

    // Check DNI Realtime
    useEffect(() => {
        const checkDni = async () => {
            if (guestDni.length > 5 && bookingType === 'guest') {
                try {
                    const response = await api.get(`/api/users/check-dni?dni=${guestDni}`, config);
                    if (response.data) {
                        const user = response.data;
                        const restrictedRoles = ['admin', 'administrador', 'administracion', 'comercio', 'staff'];
                        const isRestricted = restrictedRoles.includes((user.role || '').toLowerCase());

                        if (user.isActive === false || isRestricted) {
                            setExistingUser(null);
                            return;
                        }

                        // "Premium" Experience: Auto-switch to Existing Client
                        setExistingUser(user);

                        // Give a tiny delay for the user to see the match before switching
                        setTimeout(() => {
                            setBookingType('existing');
                            setSelectedClientId(user.id);
                            // Clear guest fields to keep state clean
                            setGuestName('');
                            setGuestPhone('');
                            setGuestEmail('');
                            setGuestDni('');
                            setExistingUser(null);

                            // Auto-scroll to duration section to speed up workflow
                            setTimeout(() => {
                                document.getElementById('duration-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                        }, 800);
                    }
                } catch (err) {
                    setExistingUser(null);
                }
            } else {
                setExistingUser(null);
            }
        };

        const timer = setTimeout(checkDni, 500);
        return () => clearTimeout(timer);
    }, [guestDni, bookingType]);

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
        const endTime = addMinutes(startDate, duration);
        const endTimeStr = format(endTime, "yyyy-MM-dd'T'HH:mm:ss");

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

            // Preguntar si desea notificar inmediatamente
            const shouldNotify = window.confirm("¡Reserva creada con éxito! ¿Deseas enviar el comprobante por WhatsApp ahora?");
            if (shouldNotify) {
                handleSendWhatsApp({
                    user: existingUser,
                    guestName: guestName,
                    guestPhone: guestPhone,
                    startTime: startTimeStr,
                    court: selectedTimeSlot.resource.data,
                    spaceId: selectedTimeSlot.resource.type === 'space' ? (selectedTimeSlot.resource.data as Space).id : null
                });
            }

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
            const currentConfig = getAuthConfig();
            console.log("Anulando serie:", groupId);
            await api.delete(`/api/bookings/series/${groupId}`, currentConfig);
            setIsConfirmingSeriesCancel(false);
            setIsConfirmingSeriesCancelSeriesId(null);
            setIsDetailsModalOpen(false);
            fetchData();
            alert("La serie ha sido anulada con éxito.");
        } catch (err: any) {
            console.error("Error al cancelar serie", err);
            const errorDetail = err.response?.data?.message || err.response?.data || err.message;
            alert("Error al cancelar serie: " + (typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail));
        }
    };

    const handleCancelBooking = async (bookingOverride?: Booking | SpaceBooking) => {
        const booking = bookingOverride || selectedBooking || selectedSpaceBooking;
        if (!booking) {
            alert("No hay reserva seleccionada.");
            return;
        }

        // Si no está en modo confirmación, activarlo
        if (!isConfirmingCancel) {
            setIsConfirmingCancel(true);
            return;
        }

        try {
            const b = booking as any;
            const isSpace = !!b.spaceId || !!b.SpaceId;
            const url = isSpace ? `/api/spacebookings/${b.id}` : `/api/bookings/${b.id}`;

            const currentConfig = getAuthConfig();
            await api.delete(url, currentConfig);

            setIsDetailsModalOpen(false);
            setIsConfirmingCancel(false);
            resetForm();
            fetchData();
            alert("Turno anulado con éxito.");
        } catch (err: any) {
            console.error("Error al cancelar", err);
            const errorMsg = err.response?.data?.message || err.response?.data || err.message || "Error desconocido";
            alert(`No se pudo anular la reserva: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
            setIsConfirmingCancel(false);
        }
    };

    const handleSendWhatsApp = (booking: any) => {
        const rawPhone = booking.user?.phoneNumber || booking.guestPhone;
        const name = booking.user?.fullName || booking.guestName || "Cliente";

        if (!rawPhone) {
            alert("El cliente no tiene un teléfono registrado.");
            return;
        }

        // 1. Limpieza extrema del número (solo dígitos)
        let cleanPhone = rawPhone.replace(/\D/g, '');

        // 2. Lógica específica para Argentina (país -03:00)
        // Quitar '0' inicial si lo tiene (ej: 0299 -> 299)
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.substring(1);
        }
        // Quitar el '15' si está después del código de área o al inicio
        // Si el número tiene 12 dígitos y empieza con 29915... -> 299...
        if (cleanPhone.length > 10 && cleanPhone.includes('15')) {
            cleanPhone = cleanPhone.replace('15', '');
        }

        // 3. Asegurar formato Internacional (54 + 9 + Área + Número)
        // Ejemplo: 2994012345 (10 dígitos) -> 5492994012345
        if (cleanPhone.length === 10) {
            cleanPhone = '549' + cleanPhone;
        }
        // Si ya tiene el 54 pero le falta el 9 (ej: 54299... -> 549299...)
        else if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length === 12) {
            cleanPhone = '549' + cleanPhone.substring(2);
        }

        const dateStr = format(parseSafeDate(booking.startTime), 'EEEE dd/MM', { locale: es });
        const timeStr = format(parseSafeDate(booking.startTime), 'HH:mm');
        const courtName = booking.court?.name || (booking.spaceId ? 'Espacio Común' : 'Cancha');

        const message = `Hola ${name}, te recordamos tu turno en PadelQ para el día ${dateStr} a las ${timeStr} en ${courtName}. ¡Te esperamos!`;
        const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;

        // Usamos un nombre de ventana fijo para REUTILIZAR la misma pestaña
        window.open(url, 'PadelQ_WhatsApp_Session');
    };

    const resetForm = () => {
        setSearchClient('');
        setSelectedClientId('');
        setGuestName('');
        setGuestPhone('');
        setGuestEmail('');
        setGuestDni('');
        setExistingUser(null);
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
        setIsConfirmingCancel(false);
        setIsClosingCourt(false);
        setRentFractionsCount(1);
        setSelectedRentFractions([]);
        setSelectedConsumptionsIds([]);
        setBarcodeInput('');
        setProductSearch('');
        setPaymentObservation('');
    };

    const handleConfirmPayment = async () => {
        const booking = selectedBooking || selectedSpaceBooking;
        const isSpace = !!selectedSpaceBooking;

        if (!booking || !selectedPaymentMethod) {
            alert("Por favor seleccione un medio de pago");
            return;
        }

        const finalPrice = booking.price;
        const rentRemaining = Math.max(0, finalPrice - booking.depositPaid);
        const fractionAmount = rentRemaining / rentFractionsCount;

        const unpaidConsumptions = bookingConsumptions.filter(c => !c.isPaid);

        const totalRentPayment = selectedRentFractions.length * fractionAmount;
        const selectedConsObjs = unpaidConsumptions.filter(c => selectedConsumptionsIds.includes(c.id));
        const totalConsumptionsPayment = selectedConsObjs.reduce((acc, c) => acc + c.totalPrice, 0);

        const currentTransactionTotal = totalRentPayment + totalConsumptionsPayment;

        if (currentTransactionTotal <= 0) {
            alert("Seleccione al menos una parte de cancha o consumición para pagar.");
            return;
        }

        try {
            setLoading(true);

            // Verificar estado de caja antes de cobrar
            try {
                const cashRes = await api.get('/api/cash-closures/current-status', config);
                if (!cashRes.data.activeClosure || !cashRes.data.activeClosure.isOpen) {
                    if (window.confirm("ATENCIÓN: La caja se encuentra CERRADA. Para registrar este pago, la caja debe estar abierta.\n\n¿Deseas abrir la caja ahora automáticamente (con saldo inicial $0)?")) {
                        await api.post('/api/cash-closures/open', { initialCash: 0, notes: "Apertura automática por cobro" }, config);
                    } else {
                        setLoading(false);
                        return; // Se cancela el pago
                    }
                }
            } catch (err) {
                console.error("Error al verificar la caja", err);
            }

            const startTimeFormatted = format(parseSafeDate(booking.startTime), 'HH:mm');
            const endTimeFormatted = format(parseSafeDate(booking.endTime), 'HH:mm');
            const schedule = `${startTimeFormatted}-${endTimeFormatted}`;

            const method = paymentMethods.find(m => m.id.toString() === selectedPaymentMethod);

            // Generar transacción para la cancha
            if (totalRentPayment > 0) {
                let rentDesc = `${isSpace ? 'Espacio' : 'Cancha'}: ${isSpace ? (booking as SpaceBooking).space.name : (booking as Booking).court.name} (${schedule})`;
                if (rentFractionsCount > 1) rentDesc += ` - Pago Parte ${selectedRentFractions.length} de ${rentFractionsCount}`;

                if (method?.name === "BONIFICADO / SIN COSTO") rentDesc = `Bonificación: ` + rentDesc;
                else rentDesc += ` (${method?.name})`;

                if (paymentObservation) rentDesc += ` - Obs: ${paymentObservation}`;

                await api.post(`/api/transaction/payment?amount=${totalRentPayment}&description=${encodeURIComponent(rentDesc)}&paymentMethodId=${selectedPaymentMethod}${booking.userId ? `&userId=${booking.userId}` : ''}`, {}, config);

                if (isSpace) {
                    await api.post(`/api/spacebookings/${booking.id}/partial-pay?amount=${totalRentPayment}`, {}, config);
                } else {
                    await api.post(`/api/bookings/${booking.id}/partial-pay?amount=${totalRentPayment}`, {}, config);
                }
            }

            // Generar transacciones para consumiciones seleccionadas
            for (const c of selectedConsObjs) {
                let consDesc = `${c.quantity}x ${c.product.name}`;
                if (c.notes) consDesc += ` (Obs: ${c.notes})`;
                if (method?.name === "BONIFICADO / SIN COSTO") consDesc = `Bonificación: ` + consDesc;
                else consDesc += ` (${method?.name})`;
                if (paymentObservation) consDesc += ` - Obs: ${paymentObservation}`;

                await api.post(`/api/transaction/payment?amount=${c.totalPrice}&description=${encodeURIComponent(consDesc)}&paymentMethodId=${selectedPaymentMethod}${booking.userId ? `&userId=${booking.userId}` : ''}`, {}, config);

                await api.put(`/api/consumptions/${c.id}/pay`, {}, config);
            }

            // Verificar si el turno ya está 100% pagado
            const checkRes = await api.get(`/api/${isSpace ? 'spacebookings' : 'bookings'}/${booking.id}`, config);
            const updatedBooking = checkRes.data;
            const newUnpaidConsumptions = (await api.get(`/api/consumptions/booking/${booking.id}`, config)).data.filter((x: any) => !x.isPaid);

            if (updatedBooking.depositPaid >= updatedBooking.price && newUnpaidConsumptions.length === 0) {
                await api.post(`/api/${isSpace ? 'spacebookings' : 'bookings'}/${booking.id}/pay`, {}, config);
                setIsDetailsModalOpen(false);
                resetForm();
                fetchData();
                alert("Pago final completado con éxito");
            } else {
                if (isSpace) setSelectedSpaceBooking(updatedBooking);
                else setSelectedBooking(updatedBooking);
                setBookingConsumptions((await api.get(`/api/consumptions/booking/${booking.id}`, config)).data);
                setSelectedRentFractions([]);
                setSelectedConsumptionsIds([]);
                setPaymentObservation('');
                fetchData();
                alert(`Pago registrado correctamente.\nQueda saldo pendiente.`);
            }

            fetchData();
        } catch (err: any) {
            console.error("Error al procesar pago:", err);
            alert("Error al procesar el pago: " + (err.response?.data || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handlePrintTicket = () => {
        const booking = selectedBooking || selectedSpaceBooking;
        if (!booking) return;

        const printWindow = window.open('', '_blank', 'width=300,height=600');
        if (!printWindow) return;

        const rentDetail = selectedBooking
            ? `${selectedBooking.court.name} (${format(parseISO(selectedBooking.startTime), 'HH:mm')} a ${format(parseISO(selectedBooking.endTime), 'HH:mm')} hs)`
            : `${selectedSpaceBooking?.space.name} (${format(parseISO(selectedSpaceBooking!.startTime), 'HH:mm')} a ${format(parseISO(selectedSpaceBooking!.endTime), 'HH:mm')} hs)`;

        const ticketHtml = `
            <html>
            <head>
                <style>
                    @media print {
                        @page { margin: 0; }
                        body { margin: 0; padding: 0; }
                    }
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        width: 80mm; 
                        margin: 0; 
                        padding: 4mm; 
                        font-size: 12px;
                        line-height: 1.3;
                        color: #000;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .line { border-bottom: 2px dashed #000; margin: 6px 0; }
                    .flex { display: flex; justify-content: space-between; }
                    .title { font-size: 22px; margin-bottom: 2px; }
                    .no-fiscal { font-size: 10px; margin: 5px 0; border: 1px solid #000; padding: 2px; display: inline-block; }
                    .footer { font-size: 10px; margin-top: 15px; text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin: 5px 0; }
                    td { padding: 3px 0; vertical-align: top; }
                    .price { text-align: right; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="center">
                    <div class="no-fiscal bold">DOCUMENTO NO VÁLIDO COMO FACTURA</div>
                    <div class="title bold">${companyInfo.name.toUpperCase()}</div>
                    <div style="font-size: 10px; margin-bottom: 5px;">
                        ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
                        ${companyInfo.phone ? `<div>Tel: ${companyInfo.phone}</div>` : ''}
                        ${companyInfo.email ? `<div>${companyInfo.email}</div>` : ''}
                        ${companyInfo.website ? `<div>${companyInfo.website}</div>` : ''}
                    </div>
                    <div style="font-size: 11px; margin-top: 5px; border-top: 1px solid #eee; padding-top: 5px;">
                        ${new Date().toLocaleDateString('es-AR')} - ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                    </div>
                </div>
                
                <div class="line"></div>
                <div class="bold uppercase">CLIENTE: ${booking.user?.fullName || booking.guestName || 'Particular'}</div>
                <div class="line"></div>
                
                <div class="bold">ALQUILER:</div>
                <div>${rentDetail}</div>
                <div class="flex">
                    <span>Precio:</span>
                    <span class="bold">$${booking.price.toLocaleString('es-AR')}</span>
                </div>
                
                <div class="line"></div>
                <div class="bold">CONSUMICIONES:</div>
                <table>
                    <tbody>
                        ${(() => {
                const grouped = bookingConsumptions.reduce((acc: any, curr: any) => {
                    const key = curr.productId;
                    if (!acc[key]) {
                        acc[key] = { ...curr };
                    } else {
                        acc[key].quantity += curr.quantity;
                        acc[key].totalPrice += curr.totalPrice;
                        acc[key].createdAt = curr.createdAt;
                    }
                    return acc;
                }, {});

                const sortedGroups = Object.values(grouped).sort((a: any, b: any) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );

                return sortedGroups.map((c: any) => `
                                <tr>
                                    <td>
                                        ${c.product?.name}<br>
                                        <small>${c.quantity} x $${c.unitPrice.toLocaleString('es-AR')}</small>
                                    </td>
                                    <td class="price">$${c.totalPrice.toLocaleString('es-AR')}</td>
                                </tr>
                            `).join('');
            })()}
                    </tbody>
                </table>
                
                <div class="line"></div>
                
                <div class="flex" style="font-size: 13px;">
                    <span>TOTAL:</span>
                    <span class="bold">$${(booking.price + bookingConsumptions.reduce((sum, c) => sum + c.totalPrice, 0)).toLocaleString('es-AR')}</span>
                </div>
                <div class="flex">
                    <span>PAGADO:</span>
                    <span>-$${booking.depositPaid.toLocaleString('es-AR')}</span>
                </div>
                
                <div class="flex bold" style="font-size: 16px; margin-top: 5px;">
                    <span>PENDIENTE:</span>
                    <span>$${Math.max(0, (booking.price + bookingConsumptions.reduce((sum, c) => sum + c.totalPrice, 0)) - booking.depositPaid).toLocaleString('es-AR')}</span>
                </div>

                <div class="line"></div>
                <div class="footer">
                    <div class="bold">DOCUMENTO NO VÁLIDO COMO FACTURA</div>
                    <div>¡Gracias por elegir PadelQ!</div>
                </div>
                <div style="height: 10px;"></div> <!-- Pequeño espacio final para que el corte no toque el texto -->

                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 200);
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(ticketHtml);
        printWindow.document.close();
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
                                    className={`flex-shrink-0 w-24 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all duration-300 border ${isSelected
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
                                        <div className="w-[120px] pr-4 flex justify-end scale-110">
                                            <div className="flex items-center gap-1.5 bg-rose-500 text-white px-2.5 py-1 rounded-full shadow-[0_4px_12px_rgba(225,29,72,0.3)] border border-white/20">
                                                <span className="text-[8px] font-black uppercase tracking-tighter">AHORA</span>
                                                <div className="w-px h-2 bg-white/30"></div>
                                                <span className="text-[10px] font-black italic tracking-tighter tabular-nums">
                                                    {format(new Date(), 'HH:mm:ss')}
                                                </span>
                                            </div>
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
                                        <div className={`p-4 border-r-2 border-b border-zinc-200 flex flex-col items-center justify-center transition-all ${(courts.some(c => getBookingFor(c.id, hour) || getActivityFor(c.id, 'court', hour)) || spaces.some(s => getSpaceBookingFor(s.id, hour) || getActivityFor(s.id, 'space', hour)))
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
                                            const activity = getActivityFor(court.id, 'court', hour);
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
                                                    onClick={() => !activity && handleOpenBooking(court, 'court', hour)}
                                                >
                                                    {activity && (
                                                        <div className="absolute inset-2 bg-black/90 rounded-2xl p-3 shadow-xl flex flex-col justify-center items-center text-center border-2 border-amber-500/30 animate-in fade-in zoom-in duration-300 z-20">
                                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500"></div>
                                                            <p className="text-[7px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">OCUPADO: ACTIVIDAD</p>
                                                            <p className="text-[10px] font-black text-white uppercase italic tracking-wider leading-tight">{activity.activity.name}</p>
                                                            <p className="text-[8px] font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Prof. {activity.activity.instructorName}</p>
                                                        </div>
                                                    )}
                                                    {booking ? (
                                                        isStartHour && (
                                                                <div
                                                                    style={{
                                                                        top: `calc(${topOffset}% + 8px)`,
                                                                        bottom: `calc(${(1 - (dur + topOffset / 100)) * 100}% + 8px)`
                                                                    }}
                                                                    className={`absolute inset-x-2 text-white rounded-xl shadow-xl flex flex-col transition-all hover:scale-[1.01] hover:z-50 border border-white/10 z-30 group/item`}
                                                                >
                                                                    <div className={`absolute inset-0 rounded-xl overflow-hidden pointer-events-none bg-gradient-to-br ${colorClass}`}>
                                                                        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 rotate-12 transition-transform group-hover/item:translate-x-full duration-1000"></div>
                                                                    </div>

                                                                    <div className="flex flex-col h-full relative z-10 justify-between p-2">
                                                                        {/* Cabecera: Cancelar (Top Right) */}
                                                                        <div className="absolute top-2 right-2 z-20">
                                                                            {(isAdmin || booking.depositPaid < booking.price) && (
                                                                                <button
                                                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCancelBooking(booking); }}
                                                                                    className="p-1 bg-white/10 hover:bg-rose-600 rounded transition-colors border border-white/5 backdrop-blur-sm"
                                                                                >
                                                                                    <X className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        {/* Info Principal: Nombre, Celular, Tipo */}
                                                                        <div className="pr-5 leading-none flex-1 flex flex-col justify-center">
                                                                            <div className="flex items-center gap-1 mb-1">
                                                                                {hasActiveMembership(booking) ? <User className="w-2.5 h-2.5 text-white/60" /> : <Users className="w-2.5 h-2.5 text-white/60" />}
                                                                                <p className="text-[8px] font-black uppercase tracking-widest text-white/60 truncate">
                                                                                    {hasActiveMembership(booking) ? 'SOCIO' : 'PARTICULAR'}
                                                                                </p>
                                                                            </div>
                                                                            
                                                                            <div className="flex items-baseline gap-1.5 flex-wrap">
                                                                                <p className="text-[11px] sm:text-xs font-black uppercase italic truncate max-w-full">
                                                                                    {booking.user?.fullName || booking.guestName || "SIN NOMBRE"}
                                                                                </p>
                                                                                <p className="text-[8px] font-bold text-white/70">
                                                                                    {booking.guestPhone || booking.user?.phoneNumber || 'S/T'}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        {/* Horario y Estado de Pago */}
                                                                        <div className="mt-1 pt-1 border-t border-white/10 flex flex-wrap justify-between items-center gap-1">
                                                                            <span className="text-[8px] font-black italic text-white bg-black/20 px-1 py-0.5 rounded whitespace-nowrap">
                                                                                {format(parseSafeDate(booking.startTime), 'HH:mm')} - {format(parseSafeDate(booking.endTime), 'HH:mm')}
                                                                            </span>

                                                                            <div className={`group/debt relative flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-help ${isFullyPaid(booking) ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/20 border-rose-500/30 text-rose-200'}`}>
                                                                                <div className={`w-1 h-1 rounded-full ${isFullyPaid(booking) ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`}></div>
                                                                                <span className="text-[7.5px] font-black uppercase tracking-widest flex items-center gap-1 whitespace-nowrap">
                                                                                    {isFullyPaid(booking) ? 'PAGADO' : (
                                                                                        <>
                                                                                            {getRentDebt(booking) > 0 && <span>ALQ ${getRentDebt(booking).toLocaleString('es-AR')}</span>}
                                                                                            {getRentDebt(booking) > 0 && getConsumptionDebt(booking) > 0 && <span className="opacity-40">|</span>}
                                                                                            {getConsumptionDebt(booking) > 0 && <span>BAR ${getConsumptionDebt(booking).toLocaleString('es-AR')}</span>}
                                                                                        </>
                                                                                    )}
                                                                                </span>

                                                                                {/* Custom Tooltip */}
                                                                                {!isFullyPaid(booking) && (
                                                                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/debt:opacity-100 group-hover/debt:visible transition-all z-[100] pointer-events-none translate-y-2 group-hover/debt:translate-y-0 text-left">
                                                                                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 border-b border-zinc-800 pb-1">Detalle de Deuda</p>
                                                                                        <div className="space-y-1.5">
                                                                                            {getRentDebt(booking) > 0 && (
                                                                                                <div className="flex justify-between items-center">
                                                                                                    <span className="text-[9px] font-bold text-white">Alquiler Cancha</span>
                                                                                                    <span className="text-[10px] text-rose-400 font-black">${getRentDebt(booking).toLocaleString('es-AR')}</span>
                                                                                                </div>
                                                                                            )}
                                                                                            {getConsumptionDebt(booking) > 0 && (
                                                                                                <div className="pt-1.5 border-t border-zinc-800/50">
                                                                                                    <div className="flex justify-between items-center mb-1">
                                                                                                        <span className="text-[9px] font-bold text-white">Consumiciones Bar</span>
                                                                                                        <span className="text-[10px] text-rose-400 font-black">${getConsumptionDebt(booking).toLocaleString('es-AR')}</span>
                                                                                                    </div>
                                                                                                    <div className="space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                                                                        {(booking.bookingConsumptions || []).filter((c:any) => !c.isPaid).map((c:any, idx:number) => (
                                                                                                            <div key={idx} className="flex justify-between items-center text-[8px] text-zinc-400 pl-2">
                                                                                                                <span className="truncate pr-2">{c.quantity}x {c.product?.name || 'Producto'}</span>
                                                                                                                <span className="font-bold">${(c.totalPrice || (c.unitPrice * c.quantity)).toLocaleString('es-AR')}</span>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center text-[10px] font-black mt-2 pt-2 border-t border-zinc-800 text-white">
                                                                                            <span>TOTAL DEUDA</span>
                                                                                            <span className="text-rose-500">${getTotalDebt(booking).toLocaleString('es-AR')}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
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
                                            const activity = getActivityFor(space.id, 'space', hour);
                                            const isStartHour = booking && parseSafeDate(booking.startTime).getHours() === hour;

                                            const start = booking ? parseSafeDate(booking.startTime) : null;
                                            const end = booking ? parseSafeDate(booking.endTime) : null;
                                            const dur = (start && end) ? Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60)) : 1;
                                            const topOffset = start ? (start.getMinutes() / 60) * 100 : 0;

                                            return (
                                                <div
                                                    key={`space-${space.id}-${hour}`}
                                                    className={`border-b border-r-2 border-zinc-200/50 p-2 min-h-[75px] relative hover:bg-violet-100/50 transition-all cursor-pointer group/cell bg-violet-50/30 ${isStartHour ? 'z-40' : 'z-0'}`}
                                                    onClick={() => !activity && handleOpenBooking(space, 'space', hour)}
                                                >
                                                    {activity && (
                                                        <div className="absolute inset-2 bg-black/90 rounded-2xl p-3 shadow-xl flex flex-col justify-center items-center text-center border-2 border-amber-500/30 animate-in fade-in zoom-in duration-300 z-20">
                                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500"></div>
                                                            <p className="text-[7px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">OCUPADO: ACTIVIDAD</p>
                                                            <p className="text-[10px] font-black text-white uppercase italic tracking-wider leading-tight">{activity.activity.name}</p>
                                                            <p className="text-[8px] font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Prof. {activity.activity.instructorName}</p>
                                                        </div>
                                                    )}
                                                    {booking ? (
                                                        isStartHour && (
                                                            <div
                                                                style={{
                                                                    top: `calc(${topOffset}% + 8px)`,
                                                                    bottom: `calc(${(1 - (dur + topOffset / 100)) * 100}% + 8px)`
                                                                }}
                                                                className={`absolute inset-x-2 text-white rounded-xl p-2 shadow-xl flex flex-col justify-between overflow-hidden group/item transition-all hover:scale-[1.01] border border-white/20 z-30 bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-900 shadow-violet-500/40`}
                                                            >
                                                                <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                                                                    <Layout className="w-8 h-8 text-white rotate-12" />
                                                                </div>
                                                                <div className="flex flex-col h-full relative z-10 justify-between">
                                                                    {/* Cabecera: Cancelar (Top Right) */}
                                                                    <div className="absolute top-0 right-0 z-20">
                                                                        {(isAdmin || booking.depositPaid < booking.price) && (
                                                                            <button
                                                                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCancelBooking(booking); }}
                                                                                className="p-1 bg-white/10 hover:bg-rose-600 rounded transition-colors border border-white/5 backdrop-blur-sm"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Info Principal: Nombre, Celular, Tipo */}
                                                                    <div className="pr-5 leading-none flex-1 flex flex-col justify-center">
                                                                        <div className="flex items-center gap-1 mb-1">
                                                                            {hasActiveMembership(booking) ? <User className="w-2.5 h-2.5 text-amber-100/60" /> : <Users className="w-2.5 h-2.5 text-amber-100/60" />}
                                                                            <p className="text-[8px] font-black uppercase tracking-widest text-amber-100/60 truncate">
                                                                                {hasActiveMembership(booking) ? 'SOCIO' : 'PARTICULAR'}
                                                                            </p>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-baseline gap-1.5 flex-wrap">
                                                                            <p className="text-[11px] sm:text-xs font-black uppercase italic truncate max-w-full text-white">
                                                                                {booking.user?.fullName || booking.guestName || "SIN NOMBRE"}
                                                                            </p>
                                                                            <p className="text-[8px] font-bold text-amber-100/70">
                                                                                {booking.guestPhone || booking.user?.phoneNumber || 'S/T'}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    {/* Horario y Estado de Pago */}
                                                                    <div className="mt-1 pt-1 border-t border-white/10 flex flex-wrap justify-between items-center gap-1">
                                                                        <span className="text-[8px] font-black italic text-white bg-black/40 px-1 py-0.5 rounded whitespace-nowrap">
                                                                            {format(parseSafeDate(booking.startTime), 'HH:mm')} - {format(parseSafeDate(booking.endTime), 'HH:mm')}
                                                                        </span>

                                                                        <div className={`group/debt relative flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-help ${isFullyPaid(booking) ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/20 border-rose-500/30 text-rose-200'}`}>
                                                                            <div className={`w-1 h-1 rounded-full ${isFullyPaid(booking) ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`}></div>
                                                                            <span className="text-[7.5px] font-black uppercase tracking-widest flex items-center gap-1 whitespace-nowrap">
                                                                                {isFullyPaid(booking) ? 'PAGADO' : (
                                                                                    <>
                                                                                        {getRentDebt(booking) > 0 && <span>ALQ ${getRentDebt(booking).toLocaleString('es-AR')}</span>}
                                                                                        {getRentDebt(booking) > 0 && getConsumptionDebt(booking) > 0 && <span className="opacity-40">|</span>}
                                                                                        {getConsumptionDebt(booking) > 0 && <span>BAR ${getConsumptionDebt(booking).toLocaleString('es-AR')}</span>}
                                                                                    </>
                                                                                )}
                                                                            </span>

                                                                            {/* Custom Tooltip */}
                                                                            {!isFullyPaid(booking) && (
                                                                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/debt:opacity-100 group-hover/debt:visible transition-all z-[100] pointer-events-none translate-y-2 group-hover/debt:translate-y-0 text-left">
                                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 border-b border-zinc-800 pb-1">Detalle de Deuda</p>
                                                                                    <div className="space-y-1.5">
                                                                                        {getRentDebt(booking) > 0 && (
                                                                                            <div className="flex justify-between items-center">
                                                                                                <span className="text-[9px] font-bold text-white">Alquiler Espacio</span>
                                                                                                <span className="text-[10px] text-rose-400 font-black">${getRentDebt(booking).toLocaleString('es-AR')}</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {getConsumptionDebt(booking) > 0 && (
                                                                                            <div className="pt-1.5 border-t border-zinc-800/50">
                                                                                                <div className="flex justify-between items-center mb-1">
                                                                                                    <span className="text-[9px] font-bold text-white">Consumiciones Bar</span>
                                                                                                    <span className="text-[10px] text-rose-400 font-black">${getConsumptionDebt(booking).toLocaleString('es-AR')}</span>
                                                                                                </div>
                                                                                                <div className="space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                                                                    {(booking.bookingConsumptions || []).filter((c:any) => !c.isPaid).map((c:any, idx:number) => (
                                                                                                        <div key={idx} className="flex justify-between items-center text-[8px] text-zinc-400 pl-2">
                                                                                                            <span className="truncate pr-2">{c.quantity}x {c.product?.name || 'Producto'}</span>
                                                                                                            <span className="font-bold">${(c.totalPrice || (c.unitPrice * c.quantity)).toLocaleString('es-AR')}</span>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex justify-between items-center text-[10px] font-black mt-2 pt-2 border-t border-zinc-800 text-white">
                                                                                        <span>TOTAL DEUDA</span>
                                                                                        <span className="text-rose-500">${getTotalDebt(booking).toLocaleString('es-AR')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                            <div className="p-3 bg-violet-100 rounded-2xl">
                                                                <Plus className="w-4 h-4 text-violet-500" />
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
                                                    className={`w-full p-4 flex items-center justify-between rounded-2xl border transition-all ${selectedClientId === client.id
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
                                                className={`w-full px-8 py-5 bg-zinc-50 border rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300 transition-all ${existingUser ? 'border-indigo-300 ring-4 ring-indigo-500/5' : 'border-zinc-100'
                                                    }`}
                                                placeholder="Solo números"
                                                required
                                            />
                                            {existingUser && (
                                                <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in slide-in-from-top-1">
                                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                                                        ⚠️ CLIENTE DETECTADO: <span className="font-black italic">{existingUser.fullName}</span>
                                                    </p>
                                                    <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-tight leading-none mt-1">
                                                        Ya registrado como {existingUser.membershipName || 'Particular'}. Se usará su cuenta existente.
                                                    </p>
                                                </div>
                                            )}
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
                                <div className="space-y-4" id="duration-section">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                        Duración <span className="text-[8px] bg-emerald-500 text-black px-2 py-0.5 rounded-full animate-pulse">Siguiente Paso</span>
                                    </label>
                                    <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl overflow-x-auto scrollbar-hide">
                                        {(selectedTimeSlot.resource.type === 'court' ? [60, 120, 180] : [60, 120, 180, 240, 360, 480]).map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDuration(d)}
                                                className={`flex-shrink-0 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${duration === d
                                                    ? 'bg-white text-black shadow-sm'
                                                    : 'text-zinc-400 hover:bg-zinc-50'
                                                    }`}
                                            >
                                                {d === 60 ? '1 HORA' : `${d / 60} HORAS`}
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
                                            Total: ${(
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
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-7xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 border border-black/5">
                        <div className="p-7 bg-gradient-to-br from-zinc-800 to-black text-white relative">
                            <div className="absolute right-6 top-6 flex items-center gap-3">
                                <button
                                    onClick={handlePrintTicket}
                                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all flex items-center gap-2 group"
                                    title="Imprimir Ticket"
                                >
                                    <Printer className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-[9px] font-black uppercase tracking-widest hidden md:inline">Imprimir</span>
                                </button>
                                <button onClick={() => { setIsDetailsModalOpen(false); resetForm(); fetchData(); }} className="p-2.5 hover:bg-white/10 rounded-2xl transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Consumiciones y Cobro</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="flex items-center gap-4 mb-2">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Cliente responsable</p>
                                        {userMembership ? (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full animate-pulse">
                                                <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                                                    {userMembership.name} (-{userMembership.discount}%)
                                                </span>
                                            </div>
                                        ) : (selectedBooking || selectedSpaceBooking)?.userId ? (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full">
                                                <div className="w-1 h-1 rounded-full bg-amber-400"></div>
                                                <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">
                                                    SIN MEMBRESÍA ACTIVA
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full opacity-40">
                                                <div className="w-1 h-1 rounded-full bg-white/40"></div>
                                                <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">
                                                    PARTICULAR
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <h2 className="text-3xl font-black italic uppercase tracking-tight leading-none text-white">
                                        {(selectedBooking || selectedSpaceBooking)?.user?.fullName || (selectedBooking || selectedSpaceBooking)?.guestName || "SIN NOMBRE CARGADO"}
                                    </h2>
                                </div>
                                <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.2em] bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                                    {selectedBooking ? selectedBooking.court.name : selectedSpaceBooking?.space.name}
                                    <span className="mx-2 opacity-50">•</span>
                                    {format(parseISO((selectedBooking || selectedSpaceBooking)!.startTime), 'HH:mm')} A {format(parseISO((selectedBooking || selectedSpaceBooking)!.endTime), 'HH:mm')} HS
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 relative overflow-hidden">
                            {/* Left Column: Add Consumptions */}
                            <div className="p-8 border-r border-zinc-100 max-h-[70vh] overflow-y-auto bg-white custom-scrollbar flex flex-col relative min-h-[500px]">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block italic">Consumiciones</label>

                                            <div className="flex items-center gap-2">
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        <Search className="w-3.5 h-3.5 text-zinc-400" />
                                                        <div className="w-[1px] h-3 bg-zinc-200"></div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={barcodeInput}
                                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                                        onKeyDown={handleAddByBarcode}
                                                        placeholder="CÓDIGO DE BARRAS..."
                                                        className="pl-11 pr-4 py-2.5 bg-white border border-zinc-200 rounded-2xl text-[9px] font-black tracking-widest focus:ring-4 focus:ring-black/5 outline-none w-44 transition-all hover:border-zinc-300 focus:border-black placeholder:text-zinc-300"
                                                    />
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        const res = await api.get('/api/products', config);
                                                        setAllProducts(res.data);
                                                        setIsConsumptionModalOpen(true);
                                                    }}
                                                    className="px-5 py-2.5 bg-black text-white rounded-2xl font-black uppercase text-[9px] tracking-[0.1em] transition-all flex items-center gap-2 hover:bg-zinc-800 shadow-lg shadow-black/10 active:scale-95"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar
                                                </button>
                                            </div>
                                        </div>

                                        {bookingConsumptions.length > 0 ? (
                                            <div className="bg-white rounded-[28px] border border-zinc-100 overflow-hidden shadow-sm">
                                                {bookingConsumptions.sort((a: any, b: any) =>
                                                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                                                ).map((c: any, idx) => (
                                                    <div key={idx} className="p-6 flex justify-between items-center border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors">
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-14 h-14 bg-white rounded-2xl border border-zinc-100 flex items-center justify-center shadow-sm">
                                                                <Package className="w-6 h-6 text-black" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black uppercase italic tracking-tight text-black">{c.product?.name}</p>
                                                                <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                                                                    <span className="text-black">{c.quantity}</span> UNIDADES x ${c.unitPrice.toLocaleString()}
                                                                </p>
                                                                {c.notes && (
                                                                    <p className="text-[9px] font-bold text-emerald-500 italic mt-0.5 max-w-[200px] truncate" title={c.notes}>
                                                                        Obs: {c.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <span className="text-xl font-black italic tracking-tighter text-black">${c.totalPrice.toLocaleString()}</span>
                                                            
                                                            {c.isPaid ? (
                                                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black tracking-widest uppercase rounded-full whitespace-nowrap">
                                                                    Pagado
                                                                </span>
                                                            ) : (
                                                                (selectedBooking || selectedSpaceBooking)!.status !== 4 && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (window.confirm(`¿Quitar ${c.product?.name}?`)) {
                                                                                await api.delete(`/api/consumptions/${c.id}`, config);
                                                                                const consRes = await api.get(`/api/consumptions/booking/${(selectedBooking || selectedSpaceBooking)!.id}`, config);
                                                                                setBookingConsumptions(consRes.data || []);
                                                                            }
                                                                        }}
                                                                        className="p-3 hover:bg-rose-50 text-rose-400 rounded-xl transition-all hover:scale-110 active:scale-90"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-12 border-2 border-dashed border-zinc-100 rounded-[32px] flex flex-col items-center justify-center text-zinc-300">
                                                <Package className="w-8 h-8 mb-2 opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Sin consumos cargados</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Middle Column: Selections */}
                            <div className="p-8 max-h-[70vh] overflow-y-auto bg-white border-r border-zinc-100">
                                {(() => {
                                    const booking = selectedBooking || selectedSpaceBooking;
                                    if (!booking) return null;

                                    let basePriceForDisplay = booking.price;
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
                                        if (space) basePriceForDisplay = space.pricePerSlot;
                                    }
                                    if (basePriceForDisplay < booking.price) basePriceForDisplay = booking.price;

                                    const rentRemaining = Math.max(0, basePriceForDisplay - booking.depositPaid);
                                    const fractionAmount = rentRemaining / rentFractionsCount;
                                    const unpaidConsumptions = bookingConsumptions.filter(c => !c.isPaid);

                                    return (
                                        <div className="space-y-6">
                                            {/* Items Selection */}
                                            {rentRemaining > 0 && (
                                                <div className="bg-zinc-50 p-5 rounded-[28px] border border-zinc-100 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Dividir Cancha</span>
                                                        <div className="flex items-center gap-4">
                                                            <button onClick={() => {
                                                                setRentFractionsCount(Math.max(1, rentFractionsCount - 1));
                                                                setSelectedRentFractions([]);
                                                            }} className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-black">-</button>
                                                            <span className="font-black italic text-sm">{rentFractionsCount} partes</span>
                                                            <button onClick={() => {
                                                                setRentFractionsCount(rentFractionsCount + 1);
                                                                setSelectedRentFractions([]);
                                                            }} className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-black">+</button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Array.from({ length: rentFractionsCount }).map((_, i) => (
                                                            <label key={i} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${selectedRentFractions.includes(i) ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-zinc-200 hover:border-black/20'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRentFractions.includes(i)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedRentFractions([...selectedRentFractions, i]);
                                                                        else setSelectedRentFractions(selectedRentFractions.filter(x => x !== i));
                                                                    }}
                                                                    className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase">Parte {i + 1}</span>
                                                                    <span className="text-xs font-black text-zinc-500 italic">{formatARS(fractionAmount)}</span>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {unpaidConsumptions.length > 0 && (
                                                <div className="bg-zinc-50 p-5 rounded-[28px] border border-zinc-100 space-y-3">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Consumiciones Pendientes</span>
                                                    <div className="space-y-2">
                                                        {unpaidConsumptions.map((c: any) => (
                                                            <label key={c.id} className={`flex justify-between items-center p-3 rounded-2xl border cursor-pointer transition-all ${selectedConsumptionsIds.includes(c.id) ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-zinc-200 hover:border-black/20'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedConsumptionsIds.includes(c.id)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) setSelectedConsumptionsIds([...selectedConsumptionsIds, c.id]);
                                                                            else setSelectedConsumptionsIds(selectedConsumptionsIds.filter(id => id !== c.id));
                                                                        }}
                                                                        className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-black uppercase">{c.quantity}x {c.product.name}</span>
                                                                        {c.notes && <span className="text-[9px] text-emerald-600 font-bold truncate max-w-[150px]">Obs: {c.notes}</span>}
                                                                    </div>
                                                                </div>
                                                                <span className="text-sm font-black italic text-zinc-700">{formatARS(c.totalPrice)}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {rentRemaining <= 0 && unpaidConsumptions.length === 0 && (
                                                <div className="py-12 border-2 border-dashed border-zinc-100 rounded-[32px] flex flex-col items-center justify-center text-zinc-300 h-full">
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Todo está pagado</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Right Column: Summary & Payment */}
                            <div className="p-8 max-h-[70vh] overflow-y-auto bg-white flex flex-col">
                                <div className="space-y-6 mt-auto">
                                    {/* Price Breakdown */}
                                    {(() => {
                                        const booking = selectedBooking || selectedSpaceBooking;
                                        if (!booking) return null;

                                        let basePriceForDisplay = booking.price;
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
                                            if (space) basePriceForDisplay = space.pricePerSlot;
                                        }
                                        if (basePriceForDisplay < booking.price) basePriceForDisplay = booking.price;

                                        const totalConsumption = bookingConsumptions.reduce((acc, c) => acc + (c.totalPrice || 0), 0);
                                        const paidConsumptionsTotal = bookingConsumptions.filter(c => c.isPaid).reduce((acc, c) => acc + (c.totalPrice || 0), 0);

                                        const rentRemaining = Math.max(0, basePriceForDisplay - booking.depositPaid);
                                        const fractionAmount = rentRemaining / rentFractionsCount;
                                        const unpaidConsumptions = bookingConsumptions.filter(c => !c.isPaid);

                                        const totalRentPayment = selectedRentFractions.length * fractionAmount;
                                        const totalConsumptionsPayment = unpaidConsumptions
                                            .filter(c => selectedConsumptionsIds.includes(c.id))
                                            .reduce((acc, c) => acc + c.totalPrice, 0);

                                        const currentTransactionTotal = totalRentPayment + totalConsumptionsPayment;

                                        return (
                                            <div className="space-y-4">
                                                <div className="space-y-3 bg-zinc-50 p-6 rounded-[32px] border border-zinc-100">
                                                    <div className="flex justify-between items-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                                                        <span>Cancha Total</span>
                                                        <span className="font-outfit text-zinc-600">{formatARS(booking.price)}</span>
                                                    </div>
                                                    {totalConsumption > 0 && (
                                                        <div className="flex justify-between items-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                                                            <span>Consumos Totales</span>
                                                            <span className="font-outfit">+{formatARS(totalConsumption)}</span>
                                                        </div>
                                                    )}
                                                    {booking.depositPaid > 0 && (
                                                        <div className="flex justify-between items-center text-blue-600 text-[10px] font-black uppercase tracking-widest pt-1 border-t border-zinc-200/50">
                                                            <span>Cancha Pagada</span>
                                                            <span className="font-bold">-{formatARS(booking.depositPaid)}</span>
                                                        </div>
                                                    )}
                                                    {paidConsumptionsTotal > 0 && (
                                                        <div className="flex justify-between items-center text-blue-600 text-[10px] font-black uppercase tracking-widest">
                                                            <span>Consumos Pagados</span>
                                                            <span className="font-bold">-{formatARS(paidConsumptionsTotal)}</span>
                                                        </div>
                                                    )}
                                                    <div className="pt-4 flex justify-between items-end">
                                                        <div>
                                                            <p className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">DEUDA RESTANTE</p>
                                                        </div>
                                                        <span className="text-3xl font-black italic text-black tracking-tighter">
                                                            {formatARS(rentRemaining + unpaidConsumptions.reduce((acc, c) => acc + c.totalPrice, 0))}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-end pt-2 pb-2">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Total de Selección</span>
                                                    <span className="text-3xl font-black italic text-emerald-500 tracking-tighter">{formatARS(currentTransactionTotal)}</span>
                                                </div>

                                                {/* Observation Input */}
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Observación (Opcional)</label>
                                                    <input
                                                        type="text"
                                                        value={paymentObservation}
                                                        onChange={(e) => setPaymentObservation(e.target.value)}
                                                        placeholder="Ej: Transferencia de Juan..."
                                                        className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-black/5 outline-none text-xs font-bold text-black placeholder:text-zinc-300"
                                                    />
                                                </div>

                                                {/* Payment Methods */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    {paymentMethods
                                                        .filter(m => (selectedBooking ? m.name !== "BONIFICADO / SIN COSTO" : true))
                                                        .map(method => (
                                                            <button
                                                                key={method.id}
                                                                onClick={() => setSelectedPaymentMethod(method.id.toString())}
                                                                className={`p-4 rounded-[20px] border transition-all text-[10px] font-black uppercase flex items-center justify-center gap-2 ${selectedPaymentMethod === method.id.toString()
                                                                    ? 'bg-black text-white border-black shadow-lg'
                                                                    : 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-black/20'
                                                                    }`}
                                                            >
                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: method.hexColor }}></div>
                                                                {method.name}
                                                            </button>
                                                        ))}
                                                </div>

                                                <div className="flex gap-3">
                                                    {isAdmin && (selectedBooking || selectedSpaceBooking)!.status !== 4 && (
                                                        <button
                                                            onClick={() => handleCancelBooking(selectedBooking || selectedSpaceBooking!)}
                                                            className={`flex-1 py-5 rounded-[24px] font-black uppercase text-[10px] tracking-widest transition-all ${isConfirmingCancel
                                                                ? "bg-rose-600 text-white animate-pulse"
                                                                : "bg-rose-50 text-rose-500"
                                                                }`}
                                                        >
                                                            {isConfirmingCancel ? "Confirmar" : "Anular"}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={handleConfirmPayment}
                                                        disabled={!selectedPaymentMethod || currentTransactionTotal <= 0}
                                                        className="flex-[2] py-5 bg-emerald-500 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                                    >
                                                        Efectuar Pago
                                                    </button>
                                                </div>

                                                {selectedBooking?.recurrenceGroupId && (
                                                    <button
                                                        onClick={() => handleCancelSeries(selectedBooking.recurrenceGroupId!)}
                                                        className={`w-full py-4 rounded-[24px] font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 border-2 ${isConfirmingSeriesCancel
                                                            ? 'bg-rose-500 text-white border-rose-500 animate-pulse'
                                                            : 'border-zinc-200 text-zinc-400 hover:border-rose-200 hover:text-rose-500'
                                                            }`}
                                                    >
                                                        {isConfirmingSeriesCancel ? '¡CONFIRMAR ANULACIÓN DE SERIE!' : <><X className="w-4 h-4" /> Anular toda la serie recurrente</>}
                                                    </button>
                                                )}


                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Consumption Modal */}
            {isConsumptionModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[60] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8 bg-zinc-900 text-white relative">
                            <button onClick={() => setIsConsumptionModalOpen(false)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight">Agregar Consumisión</h2>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 mb-6">Toca un producto para cargarlo</p>

                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                    <Search className="w-5 h-5 text-white/30" />
                                    <div className="w-[1px] h-4 bg-white/10"></div>
                                </div>
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="BUSCAR POR NOMBRE O CÓDIGO DE BARRAS..."
                                    className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-[28px] text-[10px] font-black tracking-widest text-white focus:ring-4 focus:ring-white/5 outline-none transition-all hover:bg-white/10 focus:bg-white/10 placeholder:text-white/20"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            {Object.entries(
                                allProducts
                                    .filter(p =>
                                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                        (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase())) ||
                                        (p.internalCode && p.internalCode.toLowerCase().includes(productSearch.toLowerCase()))
                                    )
                                    .reduce((acc, p) => {
                                        const cat = p.category || 'Otros';
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push(p);
                                        return acc;
                                    }, {} as Record<string, any[]>)
                            ).map(([category, products]) => (
                                <div key={category} className="mb-8 last:mb-0">
                                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-4 border-b border-zinc-100 pb-2 italic">{category}</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {(products as any[]).map((product: any) => (
                                            <button
                                                key={product.id}
                                                onClick={async () => {
                                                    try {
                                                        const obs = window.prompt(`Agregar observación para ${product.name} (Opcional):`);
                                                        if (obs === null) return; // Se canceló

                                                        const qty = 1;

                                                        await api.post('/api/consumptions', {
                                                            bookingId: (selectedBooking || selectedSpaceBooking)!.id,
                                                            productId: product.id,
                                                            quantity: qty,
                                                            notes: obs
                                                        }, config);

                                                        const consRes = await api.get(`/api/consumptions/booking/${(selectedBooking || selectedSpaceBooking)!.id}`, config);
                                                        setBookingConsumptions(consRes.data || []);

                                                        // Cerramos el modal por pedido del usuario
                                                        setIsConsumptionModalOpen(false);
                                                    } catch (err: any) {
                                                        console.error("Error al agregar consumo:", err);
                                                        alert("Error al agregar: " + (err.response?.data || err.message));
                                                    }
                                                }}
                                                className="flex flex-col items-center justify-center p-4 bg-zinc-50 border border-zinc-100 rounded-[32px] hover:border-black hover:bg-white hover:shadow-2xl hover:-translate-y-1 transition-all group aspect-square relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-12 h-12 bg-black/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-black group-hover:scale-150 duration-500"></div>

                                                <div className="p-4 bg-white rounded-2xl border border-zinc-100 mb-3 group-hover:bg-black group-hover:text-white transition-all shadow-sm z-10">
                                                    <Package className="w-6 h-6" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase italic text-center leading-tight mb-1 z-10">{product.name}</p>
                                                <p className="text-base font-black italic text-black z-10">${product.finalPrice}</p>

                                                <div className="absolute bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[8px] font-black uppercase tracking-widest bg-black text-white px-2 py-1 rounded-full">Agregar +</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingsPage;
