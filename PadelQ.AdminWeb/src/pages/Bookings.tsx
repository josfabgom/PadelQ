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
    addMinutes,
    areIntervalsOverlapping
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

    AlertCircle,
    Package,
    RefreshCw,
    Printer,
    Minus,
    Layers
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
    guestDni?: string;
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
    guestDni?: string;
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
    const [isMixedPayment, setIsMixedPayment] = useState(false);
    const [isMixedPaymentModalOpen, setIsMixedPaymentModalOpen] = useState(false);
    const [secondPaymentMethod, setSecondPaymentMethod] = useState<string>('');
    const [firstMethodAmount, setFirstMethodAmount] = useState<number>(0);
    const [bookingConsumptions, setBookingConsumptions] = useState<any[]>([]);
    const [relatedBookings, setRelatedBookings] = useState<any[]>([]);
    const [selectedRelatedBookingIds, setSelectedRelatedBookingIds] = useState<string[]>([]);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
    const [isAddingConsumption, setIsAddingConsumption] = useState<number | null>(null);
    const [productForObservation, setProductForObservation] = useState<any | null>(null);
    const [tempObservation, setTempObservation] = useState('');
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
    const [paymentSuccessInfo, setPaymentSuccessInfo] = useState<{
        isOpen: boolean;
        amount: number;
        remaining: number;
        isPartial: boolean;
    } | null>(null);
    const [courtFractions, setCourtFractions] = useState<Record<string, number>>({});
    const [selectedCourtParts, setSelectedCourtParts] = useState<Record<string, number[]>>({});
    const [consumptionFractions, setConsumptionFractions] = useState<Record<string, number>>({});
    const [selectedConsumptionParts, setSelectedConsumptionParts] = useState<Record<string, number[]>>({});
    const [globalFractionsCount, setGlobalFractionsCount] = useState(1);
    const [selectedGlobalFractions, setSelectedGlobalFractions] = useState<number[]>([0]);
    const [paymentObservation, setPaymentObservation] = useState('');
    // Form states
    const [bookingType, setBookingType] = useState<'existing' | 'guest'>('guest');
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
    const [multiCourtSuggestion, setMultiCourtSuggestion] = useState<{
        isOpen: boolean;
        startTime: string;
        duration: number;
        bookingType: 'existing' | 'guest';
        clientId: string;
        guestName: string;
        guestPhone: string;
        guestEmail: string;
        guestDni: string;
        isRecurring: boolean;
        endDate: string | null;
        originalCourtId: number;
    } | null>(null);

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
                // Pre-seleccionar solo la parte 1 de la cancha principal por conveniencia
                setSelectedCourtParts({ [existing.id]: [0] });
                setCourtFractions({ [existing.id]: 1 });
                setSelectedConsumptionParts({});
                setConsumptionFractions({});
                setSelectedRelatedBookingIds([]);

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

                // BUSCAR OTRAS RESERVAS DEL MISMO CLIENTE HOY (COBRO CONJUNTO)
                const otherB = (bookings || []).filter(b => 
                    b.id !== existing.id && 
                    b.status !== 2 &&
                    ((b.userId && b.userId === existing.userId) || 
                     (b.guestDni && b.guestDni === existing.guestDni) ||
                     (b.guestName && b.guestName === existing.guestName))
                );
                const otherSB = (spaceBookings || []).filter(sb => 
                    sb.id !== existing.id && 
                    sb.status !== 2 &&
                    ((sb.userId && sb.userId === existing.userId) || 
                     (sb.guestDni && sb.guestDni === existing.guestDni) ||
                     (sb.guestName && sb.guestName === existing.guestName))
                );

                const allR = [...otherB, ...otherSB];
                setRelatedBookings(allR);
                if (allR.length > 0) {
                    setSelectedRelatedBookingIds(allR.map(x => x.id));
                    setCourtFractions({ ...courtFractions, ['consolidated-rent']: 1 });
                    setSelectedCourtParts({ ...selectedCourtParts, ['consolidated-rent']: [0] });
                }

                // Fetch consumptions for all related bookings
                try {
                    const mainConsRes = await api.get(`/api/consumptions/booking/${existing.id}`, config);
                    const mainCons = (mainConsRes.data || []).map((c: any) => ({ ...c, sourceName: existing.court.name }));
                    
                    let allCons = [...mainCons];
                    for (const rb of allR) {
                        const rbConsRes = await api.get(`/api/consumptions/booking/${rb.id}`, config);
                        const rbCons = (rbConsRes.data || []).map((c: any) => ({ ...c, sourceName: (rb as any).court?.name || (rb as any).space?.name }));
                        allCons = [...allCons, ...rbCons];
                    }
                    setBookingConsumptions(allCons);
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
                // Pre-seleccionar solo la parte 1 de la cancha principal por conveniencia
                setSelectedCourtParts({ [existing.id]: [0] });
                setCourtFractions({ [existing.id]: 1 });
                setSelectedConsumptionParts({});
                setConsumptionFractions({});
                setSelectedRelatedBookingIds([]);
                setUserMembership(null);

                // BUSCAR OTRAS RESERVAS DEL MISMO CLIENTE HOY (COBRO CONJUNTO)
                const otherB = (bookings || []).filter(b => 
                    b.status !== 2 &&
                    ((b.userId && b.userId === existing.userId) || 
                     (b.guestDni && b.guestDni === existing.guestDni) ||
                     (b.guestName && b.guestName === existing.guestName))
                );
                const otherSB = (spaceBookings || []).filter(sb => 
                    sb.id !== existing.id && 
                    sb.status !== 2 &&
                    ((sb.userId && sb.userId === existing.userId) || 
                     (sb.guestDni && sb.guestDni === existing.guestDni) ||
                     (sb.guestName && sb.guestName === existing.guestName))
                );

                const allR = [...otherB, ...otherSB];
                setRelatedBookings(allR);
                if (allR.length > 0) {
                    setSelectedRelatedBookingIds(allR.map(x => x.id));
                    setCourtFractions({ ...courtFractions, ['consolidated-rent']: 1 });
                    setSelectedCourtParts({ ...selectedCourtParts, ['consolidated-rent']: [0] });
                }

                // Fetch consumptions for all related bookings
                try {
                    const mainConsRes = await api.get(`/api/consumptions/booking/${existing.id}`, config);
                    const mainCons = (mainConsRes.data || []).map((c: any) => ({ ...c, sourceName: existing.space.name }));
                    
                    let allCons = [...mainCons];
                    for (const rb of allR) {
                        const rbConsRes = await api.get(`/api/consumptions/booking/${rb.id}`, config);
                        const rbCons = (rbConsRes.data || []).map((c: any) => ({ ...c, sourceName: (rb as any).court?.name || (rb as any).space?.name }));
                        allCons = [...allCons, ...rbCons];
                    }
                    setBookingConsumptions(allCons);
                } catch (e) {
                    setBookingConsumptions([]);
                }
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

        if (bookingType === 'guest' && !guestName) {
            alert('El nombre es obligatorio para clientes particulares');
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
                    guestName: bookingType === 'guest' ? (guestName || null) : null,
                    guestPhone: bookingType === 'guest' ? (guestPhone || null) : null,
                    guestEmail: bookingType === 'guest' ? (guestEmail || null) : null,
                    dni: bookingType === 'guest' ? (guestDni || null) : null,
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
                    guestName: bookingType === 'guest' ? (guestName || null) : null,
                    guestPhone: bookingType === 'guest' ? (guestPhone || null) : null,
                    guestEmail: bookingType === 'guest' ? (guestEmail || null) : null,
                    dni: bookingType === 'guest' ? (guestDni || null) : null,
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
            
            // Guardar info para sugerencia de multi-cancha (solo si es cancha y no es recurrente por ahora para evitar complejidad)
            const isCourt = selectedTimeSlot.resource.type === 'court';
            const suggestionData = (isCourt && !isRecurring) ? {
                isOpen: true,
                startTime: startTimeStr,
                duration: duration,
                bookingType,
                clientId: selectedClientId,
                guestName,
                guestPhone,
                guestEmail,
                guestDni,
                isRecurring: false,
                endDate: null,
                originalCourtId: selectedTimeSlot.resource.data.id
            } : null;

            // Resetear formulario y recargar datos
            resetForm();
            fetchData();
            
            if (suggestionData) {
                setMultiCourtSuggestion(suggestionData as any);
            } else {
                alert("¡Reserva creada con éxito!");
            }

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
        setGlobalFractionsCount(1);
        setSelectedGlobalFractions([0]);
        setBarcodeInput('');
        setProductSearch('');
        setPaymentObservation('');
        setIsMixedPayment(false);
        setIsMixedPaymentModalOpen(false);
        setSecondPaymentMethod('');
        setFirstMethodAmount(0);
        setRelatedBookings([]);
        setSelectedRelatedBookingIds([]);
        setGlobalFractionsCount(1);
        setSelectedGlobalFractions([0]);
    };

    const handleConfirmPayment = async () => {
        const booking = selectedBooking || selectedSpaceBooking;
        const isSpace = !!selectedSpaceBooking;

        if (!booking || !selectedPaymentMethod) {
            alert("Por favor seleccione un medio de pago");
            return;
        }

        // --- CÁLCULO DE PAGO GRANULAR ---
        let totalRentPayment = 0;
        let totalConsumptionsPayment = 0;
        const groupPayments: { productId: number, amount: number, desc: string, ids: string[] }[] = [];
        const relatedBookingsPayments: { id: string, amount: number, desc: string }[] = [];

        // --- CÁLCULO DE PAGO DE RENTA (CONSOLIDADA O INDIVIDUAL) ---
        const selectedRentals = [booking, ...relatedBookings.filter(rb => selectedRelatedBookingIds.includes(rb.id))];
        const isConsolidated = selectedRelatedBookingIds.length > 0;
        
        if (isConsolidated) {
            const totalConsolidatedDebt = selectedRentals.reduce((sum, r) => sum + ((r.price || 0) - (r.depositPaid || 0)), 0);
            const fractions = courtFractions['consolidated-rent'] || 1;
            const selectedParts = selectedCourtParts['consolidated-rent'] || [];
            
            if (totalConsolidatedDebt > 0 && selectedParts.length > 0) {
                const totalPaidForRent = (totalConsolidatedDebt / fractions) * selectedParts.length;
                totalRentPayment = totalPaidForRent;

                // Distribuir el pago proporcionalmente entre las reservas involucradas
                selectedRentals.forEach(r => {
                    const rDebt = (r.price || 0) - (r.depositPaid || 0);
                    if (rDebt > 0) {
                        const rRatio = rDebt / totalConsolidatedDebt;
                        const rAmount = totalPaidForRent * rRatio;
                        relatedBookingsPayments.push({
                            id: r.id,
                            amount: rAmount,
                            desc: `Renta ${isSpace ? 'Espacio' : 'Cancha'}: ${(r as any).court?.name || (r as any).space?.name} (${format(parseSafeDate(r.startTime), 'HH:mm')}-${format(parseSafeDate(r.endTime), 'HH:mm')})`
                        });
                    }
                });
            }
        } else {
            // Pago Individual (solo la principal)
            const mainRentDebt = (booking.price || 0) - (booking.depositPaid || 0);
            const mainFractions = courtFractions[booking.id] || 1;
            const mainSelectedParts = selectedCourtParts[booking.id] || [];
            if (mainRentDebt > 0 && mainSelectedParts.length > 0) {
                totalRentPayment = (mainRentDebt / mainFractions) * mainSelectedParts.length;
                relatedBookingsPayments.push({
                    id: booking.id,
                    amount: totalRentPayment,
                    desc: `Renta ${isSpace ? 'Espacio' : 'Cancha'}: ${(booking as any).court?.name || (booking as any).space?.name} (${format(parseSafeDate(booking.startTime), 'HH:mm')}-${format(parseSafeDate(booking.endTime), 'HH:mm')})`
                });
            }
        }

        // 3. Pago de Consumiciones (Agrupadas por Producto)
        const unpaidConsumptions = (bookingConsumptions || []).filter(c => !c.isPaid);
        const grouped = unpaidConsumptions.reduce((acc, c) => {
            const pid = c.productId;
            if (!acc[pid]) {
                acc[pid] = {
                    productId: pid,
                    productName: c.product?.name || "Producto",
                    totalPrice: 0,
                    totalDeposit: 0,
                    quantity: 0,
                    records: []
                };
            }
            acc[pid].totalPrice += (c.totalPrice || 0);
            acc[pid].totalDeposit += (c.depositPaid || 0);
            acc[pid].quantity += (c.quantity || 1);
            acc[pid].records.push(c);
            return acc;
        }, {} as Record<number, any>);

        Object.values(grouped).forEach((g: any) => {
            const groupKey = `group-${g.productId}`;
            const partsCount = consumptionFractions[groupKey] || 1;
            const selectedPartsCount = (selectedConsumptionParts[groupKey] || []).length;
            
            if (selectedPartsCount > 0) {
                const remainingPrice = g.totalPrice - g.totalDeposit;
                const partPrice = remainingPrice / partsCount;
                const amount = partPrice * selectedPartsCount;
                totalConsumptionsPayment += amount;
                
                groupPayments.push({ 
                    productId: g.productId, 
                    amount, 
                    desc: `${g.quantity}x ${g.productName}${partsCount > 1 ? ` (Parte ${selectedPartsCount}/${partsCount})` : ''}`,
                    ids: g.records.map((r: any) => r.id)
                });
            }
        });

        const currentTransactionTotal = totalRentPayment + totalConsumptionsPayment + relatedBookingsPayments.reduce((acc, p) => acc + p.amount, 0);

        if (currentTransactionTotal <= 0) {
            alert("Seleccione al menos una parte de algún ítem para cobrar.");
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

            const method = paymentMethods.find(m => m.id.toString() === selectedPaymentMethod);
            const method2 = isMixedPayment ? paymentMethods.find(m => m.id.toString() === secondPaymentMethod) : null;

            if (isMixedPayment && (!method2 || firstMethodAmount <= 0 || firstMethodAmount >= currentTransactionTotal)) {
                alert("Por favor configure correctamente el pago mixto (monto y segundo medio de pago)");
                setLoading(false);
                return;
            }

            // Función auxiliar para registrar pagos (puede ser uno o dos)
            const registerPayment = async (amount: number, methodId: string, descriptionPrefix: string) => {
                const m = paymentMethods.find(p => p.id.toString() === methodId);
                let desc = descriptionPrefix;
                if (m?.name === "BONIFICADO / SIN COSTO") desc = `Bonificación: ` + desc;
                else desc += ` (${m?.name})`;
                if (paymentObservation) desc += ` - Obs: ${paymentObservation}`;

                await api.post(`/api/transaction/payment?amount=${amount}&description=${encodeURIComponent(desc)}&paymentMethodId=${methodId}${booking.userId ? `&userId=${booking.userId}` : ''}`, {}, config);
            };

            // 1. Pagar Rentas (Individuales o Consolidadas)
            for (const rp of relatedBookingsPayments) {
                if (!isMixedPayment) {
                    await registerPayment(rp.amount, selectedPaymentMethod, rp.desc);
                } else {
                    const txRatio = rp.amount / currentTransactionTotal;
                    const p1 = firstMethodAmount * txRatio;
                    const p2 = rp.amount - p1;
                    await registerPayment(p1, selectedPaymentMethod, rp.desc + " (Parte Mixta 1)");
                    await registerPayment(p2, secondPaymentMethod, rp.desc + " (Parte Mixta 2)");
                }

                const rb = [booking, ...relatedBookings].find(x => x.id === rp.id);
                const rbIsSpace = rb && (rb.spaceId || rb.SpaceId || (rb as any).space);
                if (rbIsSpace) await api.post(`/api/spacebookings/${rp.id}/partial-pay?amount=${rp.amount}`, {}, config);
                else await api.post(`/api/bookings/${rp.id}/partial-pay?amount=${rp.amount}`, {}, config);
            }

            // 3. Pagar Consumiciones Agrupadas
            for (const gp of groupPayments) {
                if (!isMixedPayment) {
                    await registerPayment(gp.amount, selectedPaymentMethod, gp.desc);
                } else {
                    const txRatio = gp.amount / currentTransactionTotal;
                    const p1 = firstMethodAmount * txRatio;
                    const p2 = gp.amount - p1;
                    await registerPayment(p1, selectedPaymentMethod, gp.desc + " (Parte Mixta 1)");
                    await registerPayment(p2, secondPaymentMethod, gp.desc + " (Parte Mixta 2)");
                }

                // Distribuir el pago entre los registros individuales
                let remainingPaymentToDistribute = gp.amount;
                const records = grouped[gp.productId].records.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                for (const record of records) {
                    if (remainingPaymentToDistribute <= 0) break;
                    const recordRemaining = record.totalPrice - (record.depositPaid || 0);
                    if (recordRemaining <= 0) continue;

                    const paymentForThisRecord = Math.min(remainingPaymentToDistribute, recordRemaining);
                    if (paymentForThisRecord >= recordRemaining) {
                        await api.put(`/api/consumptions/${record.id}/pay`, {}, config);
                    } else {
                        await api.post(`/api/consumptions/${record.id}/partial-pay?amount=${paymentForThisRecord}`, {}, config);
                    }
                    remainingPaymentToDistribute -= paymentForThisRecord;
                }
            }

                // Actualizar todas las reservas involucradas (Principal + Relacionadas seleccionadas)
                const bookingsToReload = [booking.id, ...selectedRelatedBookingIds];
                const updatedBookingsData: any[] = [];
                
                for (const idToReload of bookingsToReload) {
                    const isS = [booking, ...relatedBookings].find(x => x.id === idToReload)?.spaceId || [booking, ...relatedBookings].find(x => x.id === idToReload)?.SpaceId;
                    const res = await api.get(isS ? `/api/spacebookings/${idToReload}` : `/api/bookings/${idToReload}`, config);
                    updatedBookingsData.push(res.data);
                }

                const updatedMain = updatedBookingsData.find(x => x.id === booking.id);
                const updatedRelated = updatedBookingsData.filter(x => x.id !== booking.id);

                if (isSpace) setSelectedSpaceBooking(updatedMain);
                else setSelectedBooking(updatedMain);
                
                // Actualizar la lista de relatedBookings con los datos nuevos
                setRelatedBookings(prev => prev.map(rb => {
                    const updated = updatedRelated.find(u => u.id === rb.id);
                    return updated || rb;
                }));

                const rentRemainingFinal = updatedBookingsData.reduce((sum, b) => sum + ((b.price || 0) - (b.depositPaid || 0)), 0);
            
            // Recargar consumos para todos los seleccionados
            let finalCons: any[] = [];
            for (const bId of bookingsToReload) {
                const bRef = [booking, ...relatedBookings].find(x => x.id === bId);
                const rbConsRes = await api.get(`/api/consumptions/booking/${bId}`, config);
                const rbCons = (rbConsRes.data || []).map((c: any) => ({ ...c, sourceName: (bRef as any).court?.name || (bRef as any).space?.name || (bRef as any).courtName }));
                finalCons = [...finalCons, ...rbCons];
            }
            
            const consRemainingFinal = finalCons.filter((c: any) => !c.isPaid).reduce((acc: number, c: any) => acc + (c.totalPrice - (c.depositPaid || 0)), 0);

            const totalRemaining = rentRemainingFinal + consRemainingFinal;

            if (totalRemaining <= 0) {
                setPaymentSuccessInfo({
                    isOpen: true,
                    amount: currentTransactionTotal,
                    remaining: 0,
                    isPartial: false
                });

                resetForm();
                fetchData();
            } else {
                if (isSpace) setSelectedSpaceBooking(updatedMain);
                else setSelectedBooking(updatedMain);
                setBookingConsumptions(finalCons);
                
                // Actualizar fracciones restantes
                const newCourtFractions = { ...courtFractions };
                const newSelectedCourtParts = { ...selectedCourtParts };
                
                if (selectedRelatedBookingIds.length > 0) {
                    const cf = courtFractions['consolidated-rent'] || 1;
                    const cs = (selectedCourtParts['consolidated-rent'] || []).length;
                    if (cs > 0) {
                        newCourtFractions['consolidated-rent'] = Math.max(1, cf - cs);
                        newSelectedCourtParts['consolidated-rent'] = [];
                    }
                } else {
                    const mainF = courtFractions[booking.id] || 1;
                    const mainS = (selectedCourtParts[booking.id] || []).length;
                    if (mainS > 0) {
                        newCourtFractions[booking.id] = Math.max(1, mainF - mainS);
                        newSelectedCourtParts[booking.id] = [];
                    }
                }

                // Para consumiciones
                const newConsFractions = { ...consumptionFractions };
                const newSelectedConsParts = { ...selectedConsumptionParts };
                groupPayments.forEach(gp => {
                    const groupKey = `group-${gp.productId}`;
                    const cf = consumptionFractions[groupKey] || 1;
                    const cs = (selectedConsumptionParts[groupKey] || []).length;
                    if (cs > 0) {
                        newConsFractions[groupKey] = Math.max(1, cf - cs);
                        newSelectedConsParts[groupKey] = [];
                    }
                });

                setCourtFractions(newCourtFractions);
                setSelectedCourtParts(newSelectedCourtParts);
                setConsumptionFractions(newConsFractions);
                setSelectedConsumptionParts(newSelectedConsParts);

                setPaymentObservation('');
                
                setPaymentSuccessInfo({
                    isOpen: true,
                    amount: currentTransactionTotal,
                    remaining: totalRemaining,
                    isPartial: true
                });
            }
        } catch (err: any) {
            console.error("Error al confirmar pago", err);
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
                                    onClick={() => setBookingType('guest')}
                                    className={`py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'guest' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                                >
                                    <User className="w-4 h-4 inline-block mr-2" /> PARTICULAR
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBookingType('existing')}
                                    className={`py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'existing' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                                >
                                    <Users className="w-4 h-4 inline-block mr-2" /> CLIENTE APP
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
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nombre Completo (Obligatorio)</label>
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
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">DNI (Opcional)</label>
                                            <input
                                                type="text"
                                                value={guestDni}
                                                onChange={(e) => setGuestDni(e.target.value)}
                                                className={`w-full px-8 py-5 bg-zinc-50 border rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300 transition-all ${existingUser ? 'border-indigo-300 ring-4 ring-indigo-500/5' : 'border-zinc-100'
                                                    }`}
                                                placeholder="Solo números"
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
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Teléfono (Opcional)</label>
                                            <input
                                                type="tel"
                                                value={guestPhone}
                                                onChange={(e) => setGuestPhone(e.target.value)}
                                                className="w-full px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold placeholder:text-zinc-300"
                                                placeholder="Ej: 381..."
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
                                                                {c.notes || c.sourceName ? (
                                                                    <p className="text-[9px] font-bold text-emerald-500 italic mt-0.5 max-w-[200px] truncate" title={`${c.sourceName ? `[${c.sourceName}] ` : ''}${c.notes || ''}`}>
                                                                        {c.sourceName && <span className="bg-emerald-500 text-white px-1 rounded-sm not-italic mr-1">[{c.sourceName}]</span>}
                                                                        {c.notes ? `Obs: ${c.notes}` : ''}
                                                                    </p>
                                                                ) : null}
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
                            <div className="p-8 max-h-[70vh] overflow-y-auto bg-white border-r border-zinc-100 space-y-8">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Items en esta cuenta</span>
                                    </div>
                                    <div className="space-y-4">
                                        {(() => {
                                            const booking = selectedBooking || selectedSpaceBooking;
                                            if (!booking) return null;

                                            const rentRemaining = Math.max(0, (booking.price || 0) - (booking.depositPaid || 0));
                                            const unpaidConsumptions = (bookingConsumptions || []).filter(c => !c.isPaid);

                                            // Agrupar consumos
                                            const grouped = unpaidConsumptions.reduce((acc, c) => {
                                                const pid = c.productId;
                                                if (!acc[pid]) {
                                                    acc[pid] = {
                                                        productId: pid,
                                                        productName: c.product?.name || "Producto",
                                                        totalPrice: 0,
                                                        totalDeposit: 0,
                                                        quantity: 0
                                                    };
                                                }
                                                acc[pid].totalPrice += (c.totalPrice || 0);
                                                acc[pid].totalDeposit += (c.depositPaid || 0);
                                                acc[pid].quantity += (c.quantity || 1);
                                                return acc;
                                            }, {} as Record<number, any>);

                                            const renderPartsSelector = (id: string, partsCount: number, selectedParts: number[], totalAmount: number, onPartsChange: (parts: number[]) => void) => {
                                                const partPrice = totalAmount / Math.max(1, partsCount);
                                                return (
                                                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/5">
                                                        {Array.from({ length: Math.max(1, partsCount) }).map((_, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (selectedParts.includes(i)) onPartsChange(selectedParts.filter(p => p !== i));
                                                                    else onPartsChange([...selectedParts, i]);
                                                                }}
                                                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${selectedParts.includes(i) ? 'bg-black text-white shadow-md' : 'bg-white text-zinc-400 border border-zinc-100 hover:border-black/20'}`}
                                                            >
                                                                <span className={selectedParts.includes(i) ? 'text-white/50' : 'text-zinc-300'}>P.{i + 1}</span>
                                                                <span>{formatARS(partPrice)}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            };

                                            const renderFractionControl = (id: string, current: number, onChange: (n: number) => void, isDark: boolean = false) => {
                                                return (
                                                    <div className={`flex items-center gap-2 ${isDark ? 'bg-white/10 border-white/10' : 'bg-white/50 border-zinc-100'} p-1 rounded-xl border`}>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, current - 1)); }}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDark ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white hover:bg-zinc-50 text-zinc-400 shadow-sm'}`}
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className={`text-[10px] font-black min-w-[20px] text-center ${isDark ? 'text-white' : 'text-zinc-600'}`}>{current}</span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onChange(current + 1); }}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDark ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white hover:bg-zinc-50 text-zinc-400 shadow-sm'}`}
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                );
                                            };

                                            return (
                                                <>
                                                    {/* 1 & 2. Rentas (Main + Selected Related) */}
                                                    {(() => {
                                                        const isConsolidated = selectedRelatedBookingIds.length > 0;
                                                        const selectedRentals = [booking, ...relatedBookings.filter(rb => selectedRelatedBookingIds.includes(rb.id))];
                                                        const totalConsolidatedDebt = selectedRentals.reduce((sum, r) => sum + ((r.price || 0) - (r.depositPaid || 0)), 0);

                                                        if (totalConsolidatedDebt <= 0) return null;

                                                        if (isConsolidated) {
                                                            // RENDER CONSOLIDADO
                                                            return (
                                                                <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-[40px] shadow-2xl relative group">
                                                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                                                        <Layers className="w-12 h-12 text-white" />
                                                                    </div>
                                                                    <div className="flex items-center justify-between relative z-10">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                                                                <Calendar className="w-6 h-6 text-white" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Renta Consolidada</p>
                                                                                <p className="text-[9px] font-bold text-zinc-500 italic max-w-[200px] truncate">
                                                                                    {selectedRentals.map(r => (r as any).court?.name || (r as any).space?.name).join(' + ')}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-3">
                                                                            <div className="text-right">
                                                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Total Saldo</p>
                                                                                <p className="text-xl font-black text-white italic tracking-tighter">{formatARS(totalConsolidatedDebt)}</p>
                                                                            </div>
                                                                            {renderFractionControl('consolidated-rent', courtFractions['consolidated-rent'] || 1, (n) => {
                                                                                setCourtFractions({ ...courtFractions, ['consolidated-rent']: n });
                                                                                setSelectedCourtParts({ ...selectedCourtParts, ['consolidated-rent']: [] });
                                                                            }, true)}
                                                                        </div>
                                                                    </div>
                                                                    {renderPartsSelector('consolidated-rent', courtFractions['consolidated-rent'] || 1, selectedCourtParts['consolidated-rent'] || [], totalConsolidatedDebt, (parts) => {
                                                                        setSelectedCourtParts({ ...selectedCourtParts, ['consolidated-rent']: parts });
                                                                    })}
                                                                    
                                                                    {/* Lista de canchas incluidas para deseleccionar */}
                                                                    <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2">
                                                                        {relatedBookings.map(rb => {
                                                                            const isIncluded = selectedRelatedBookingIds.includes(rb.id);
                                                                            if (!isIncluded) return null;
                                                                            return (
                                                                                <button 
                                                                                    key={`inc-${rb.id}`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setSelectedRelatedBookingIds(selectedRelatedBookingIds.filter(id => id !== rb.id));
                                                                                    }}
                                                                                    className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition-colors"
                                                                                >
                                                                                    <span className="text-[9px] font-black text-zinc-400 uppercase">{(rb as any).court?.name || (rb as any).space?.name}</span>
                                                                                    <X className="w-2.5 h-2.5 text-zinc-600" />
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            // RENDER INDIVIDUAL (Solo la principal)
                                                            return (
                                                                <>
                                                                    <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-[32px] group hover:border-black/10 transition-all">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center">
                                                                                    <Calendar className="w-5 h-5 text-white" />
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-[10px] font-black uppercase tracking-tight">Renta: {(booking as any).court?.name || (booking as any).space?.name}</p>
                                                                                    <p className="text-[9px] font-bold text-zinc-400 italic">{format(parseSafeDate(booking.startTime), 'HH:mm')} a {format(parseSafeDate(booking.endTime), 'HH:mm')} hs</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="text-right">
                                                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Saldo</p>
                                                                                    <p className="text-sm font-black italic tracking-tighter">{formatARS(totalConsolidatedDebt)}</p>
                                                                                </div>
                                                                                {renderFractionControl(booking.id, courtFractions[booking.id] || 1, (n) => {
                                                                                    setCourtFractions({ ...courtFractions, [booking.id]: n });
                                                                                    setSelectedCourtParts({ ...selectedCourtParts, [booking.id]: [] });
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                        {renderPartsSelector(booking.id, courtFractions[booking.id] || 1, selectedCourtParts[booking.id] || [], totalConsolidatedDebt, (parts) => {
                                                                            setSelectedCourtParts({ ...selectedCourtParts, [booking.id]: parts });
                                                                        })}
                                                                    </div>
                                                                    
                                                                    {/* Sugerencias de Consolidación */}
                                                                    {relatedBookings.length > 0 && (
                                                                        <div className="space-y-3 mt-4">
                                                                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4 mb-2">Sugerencias para Consolidar</p>
                                                                            {relatedBookings.map(rb => {
                                                                                const rbDebt = getTotalDebt(rb);
                                                                                if (rbDebt <= 0) return null;
                                                                                return (
                                                                                    <button 
                                                                                        key={rb.id}
                                                                                        onClick={() => setSelectedRelatedBookingIds([...selectedRelatedBookingIds, rb.id])}
                                                                                        className="w-full p-4 bg-white border border-zinc-100 rounded-3xl flex items-center justify-between hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                                                                                    >
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                                                                                <Plus className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500" />
                                                                                            </div>
                                                                                            <div className="text-left">
                                                                                                <p className="text-[10px] font-black uppercase text-zinc-600">{(rb as any).court?.name || (rb as any).space?.name}</p>
                                                                                                <p className="text-[8px] font-bold text-zinc-400 italic">{format(parseSafeDate(rb.startTime), 'HH:mm')} hs</p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <p className="text-[10px] font-black italic text-zinc-400 group-hover:text-indigo-600">{formatARS(rbDebt)}</p>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        }
                                                    })()}

                                                    {/* 3. Grouped Consumptions */}
                                                    {Object.values(grouped).map((g: any) => {
                                                        const groupKey = `group-${g.productId}`;
                                                        const remaining = g.totalPrice - g.totalDeposit;
                                                        if (remaining <= 0) return null;

                                                        return (
                                                            <div key={groupKey} className="p-5 bg-zinc-50 border border-zinc-100 rounded-[32px] group hover:border-black/10 transition-all">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center">
                                                                            <Package className="w-5 h-5 text-white" />
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <p className="text-[10px] font-black uppercase tracking-tight">{g.productName}</p>
                                                                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{g.quantity} unidad(es)</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="text-right">
                                                                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Saldo</p>
                                                                            <p className="text-sm font-black italic tracking-tighter">{formatARS(remaining)}</p>
                                                                        </div>
                                                                        {renderFractionControl(groupKey, consumptionFractions[groupKey] || 1, (n) => {
                                                                            setConsumptionFractions({ ...consumptionFractions, [groupKey]: n });
                                                                            setSelectedConsumptionParts({ ...selectedConsumptionParts, [groupKey]: [] });
                                                                        })}
                                                                    </div>
                                                                </div>
                                                                {renderPartsSelector(groupKey, consumptionFractions[groupKey] || 1, selectedConsumptionParts[groupKey] || [], remaining, (parts) => {
                                                                    setSelectedConsumptionParts({ ...selectedConsumptionParts, [groupKey]: parts });
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Summary & Payment */}
                            <div className="p-8 max-h-[70vh] overflow-y-auto bg-white flex flex-col">
                                <div className="space-y-6 mt-auto">
                                    {(() => {
                                        const booking = selectedBooking || selectedSpaceBooking;
                                        if (!booking) return null;

                                        const unpaidConsumptions = (bookingConsumptions || []).filter(c => !c.isPaid);
                                        const paidConsumptionsTotal = (bookingConsumptions || []).filter(c => c.isPaid).reduce((acc, c) => acc + (c.totalPrice || 0), 0);

                                        // --- CÁLCULO DE TOTAL BASADO EN SELECCIONES GRANULARES ---
                                        let currentTransactionTotal = 0;

                                        // 1 & 2. Rentas (Consolidada o Individual)
                                        if (selectedRelatedBookingIds.length > 0) {
                                            const selectedRentals = [booking, ...relatedBookings.filter(rb => selectedRelatedBookingIds.includes(rb.id))];
                                            const totalConsolidatedDebt = selectedRentals.reduce((sum, r) => sum + ((r.price || 0) - (r.depositPaid || 0)), 0);
                                            const fractions = courtFractions['consolidated-rent'] || 1;
                                            const selectedParts = selectedCourtParts['consolidated-rent'] || [];
                                            if (totalConsolidatedDebt > 0) currentTransactionTotal += (totalConsolidatedDebt / fractions) * selectedParts.length;
                                        } else {
                                            const mainRentDebt = (booking.price || 0) - (booking.depositPaid || 0);
                                            const mainFractions = courtFractions[booking.id] || 1;
                                            const mainSelectedParts = selectedCourtParts[booking.id] || [];
                                            if (mainRentDebt > 0) currentTransactionTotal += (mainRentDebt / mainFractions) * mainSelectedParts.length;
                                        }

                                        // 3. Consumiciones Agrupadas
                                        const grouped = unpaidConsumptions.reduce((acc, c) => {
                                            const pid = c.productId;
                                            if (!acc[pid]) acc[pid] = { totalPrice: 0, totalDeposit: 0 };
                                            acc[pid].totalPrice += (c.totalPrice || 0);
                                            acc[pid].totalDeposit += (c.depositPaid || 0);
                                            return acc;
                                        }, {} as Record<number, any>);

                                        Object.keys(grouped).forEach(pid => {
                                            const groupKey = `group-${pid}`;
                                            const partsCount = consumptionFractions[groupKey] || 1;
                                            const selectedPartsCount = (selectedConsumptionParts[groupKey] || []).length;
                                            const remaining = grouped[Number(pid)].totalPrice - grouped[Number(pid)].totalDeposit;
                                            if (remaining > 0) currentTransactionTotal += (remaining / partsCount) * selectedPartsCount;
                                        });

                                        const totalRentRemaining = (booking.price || 0) - (booking.depositPaid || 0);
                                        const totalConsumptionRemaining = unpaidConsumptions.reduce((acc, c) => acc + (c.totalPrice - (c.depositPaid || 0)), 0);
                                        const relatedBookingsTotalDebt = relatedBookings
                                            .filter(rb => selectedRelatedBookingIds.includes(rb.id))
                                            .reduce((acc, rb) => acc + getTotalDebt(rb), 0);

                                        const totalAccountDebt = totalRentRemaining + totalConsumptionRemaining + relatedBookingsTotalDebt;

                                        return (
                                            <div className="space-y-4">
                                                <div className="space-y-4 bg-zinc-50 p-7 rounded-[32px] border border-zinc-100 shadow-sm">
                                                    <div className="flex justify-between items-center text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                                                        <span>Deuda Total Seleccionada</span>
                                                        <span className="font-outfit">{formatARS(totalAccountDebt)}</span>
                                                    </div>

                                                    <div className="space-y-2 pt-3 border-t border-zinc-200/50">
                                                        {(booking.depositPaid + paidConsumptionsTotal) > 0 && (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex justify-between items-center text-[10px] text-blue-500 font-black uppercase tracking-widest">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                                        <span>Pagos Realizados</span>
                                                                    </div>
                                                                    <span className="font-bold">-{formatARS(booking.depositPaid + paidConsumptionsTotal)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-[8px] text-blue-400 font-bold uppercase tracking-widest pl-3">
                                                                    <span>({formatARS(booking.depositPaid)} cancha + {formatARS(paidConsumptionsTotal)} consumos)</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="pt-5 flex justify-between items-end border-t border-zinc-200">
                                                            <div>
                                                                <p className="text-zinc-900 text-[9px] font-black uppercase tracking-[0.3em] mb-1">DEUDA RESTANTE</p>
                                                            </div>
                                                            <span className="text-4xl font-black italic text-black tracking-tighter">
                                                                {formatARS(totalAccountDebt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-end pt-2 pb-2">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Total de Selección</span>
                                                    <span className="text-3xl font-black italic text-emerald-500 tracking-tighter">{formatARS(currentTransactionTotal)}</span>
                                                </div>

                                                {currentTransactionTotal > 0 && currentTransactionTotal < totalAccountDebt && (
                                                    <div className="flex justify-between items-center mb-4 px-4 py-2 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Saldo Pendiente Después</span>
                                                        <span className="text-sm font-black italic text-zinc-600">{formatARS(totalAccountDebt - currentTransactionTotal)}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Medio de Pago Principal</span>
                                                    <button 
                                                        onClick={() => {
                                                            if (!selectedPaymentMethod) {
                                                                alert("Primero selecciona el medio de pago principal");
                                                                return;
                                                            }
                                                            if (!isMixedPayment) setFirstMethodAmount(currentTransactionTotal / 2);
                                                            setIsMixedPaymentModalOpen(true);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${isMixedPayment ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'}`}
                                                    >
                                                        {isMixedPayment ? '✓ Editar Pago Mixto' : '+ Dividir Pago'}
                                                    </button>
                                                </div>

                                                {/* Payment Methods Grid */}
                                                <div className="grid grid-cols-2 gap-2">
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

                                                {isMixedPayment && !isMixedPaymentModalOpen && (
                                                    <div className="mt-2 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
                                                                <DollarSign className="w-4 h-4 text-white" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Configuración Mixta</p>
                                                                <p className="text-[10px] font-black italic">
                                                                    {paymentMethods.find(m => m.id.toString() === selectedPaymentMethod)?.name}: {formatARS(firstMethodAmount)} + {paymentMethods.find(m => m.id.toString() === secondPaymentMethod)?.name}: {formatARS(currentTransactionTotal - firstMethodAmount)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => setIsMixedPayment(false)}
                                                            className="p-1.5 hover:bg-rose-50 text-rose-400 rounded-lg transition-colors"
                                                            title="Anular Pago Mixto"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="flex gap-3 pt-4">
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
                                                        disabled={!selectedPaymentMethod || (isMixedPayment && !secondPaymentMethod) || currentTransactionTotal <= 0}
                                                        className="flex-[2] py-5 bg-emerald-500 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                                    >
                                                        {isMixedPayment ? 'Efectuar Pago Mixto' : 'Efectuar Pago'}
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
                            <h2 className="text-2xl font-black italic uppercase tracking-tight">Agregar Consumición</h2>
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
                                                disabled={isAddingConsumption === product.id}
                                                onClick={() => {
                                                    setProductForObservation(product);
                                                    setTempObservation('');
                                                }}
                                                className={`flex flex-col items-center justify-center p-4 bg-zinc-50 border border-zinc-100 rounded-[32px] hover:border-black hover:bg-white hover:shadow-2xl hover:-translate-y-1 transition-all group aspect-square relative overflow-hidden ${isAddingConsumption === product.id ? 'opacity-50 cursor-wait' : ''}`}
                                            >
                                                <div className="absolute top-0 right-0 w-12 h-12 bg-black/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-black group-hover:scale-150 duration-500"></div>

                                                <div className="p-4 bg-white rounded-2xl border border-zinc-100 mb-3 group-hover:bg-black group-hover:text-white transition-all shadow-sm z-10">
                                                    {isAddingConsumption === product.id ? (
                                                        <RefreshCw className="w-6 h-6 animate-spin" />
                                                    ) : (
                                                        <Package className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-black uppercase italic text-center leading-tight mb-1 z-10">{product.name}</p>
                                                <p className="text-base font-black italic text-black z-10">${product.finalPrice || product.FinalPrice}</p>

                                                <div className="absolute bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[8px] font-black uppercase tracking-widest bg-black text-white px-2 py-1 rounded-full">
                                                        {isAddingConsumption === product.id ? 'Cargando...' : 'Agregar +'}
                                                    </span>
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

            {/* Custom Observation Sub-Modal */}
            {productForObservation && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[70] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/5">
                        <div className="p-8 bg-black text-white">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <Package className="w-5 h-5 text-emerald-400" />
                                </div>
                                <h3 className="text-xl font-black italic uppercase tracking-tight">{productForObservation.name}</h3>
                            </div>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">¿Deseas agregar alguna nota u observación?</p>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Observaciones</label>
                                <textarea
                                    autoFocus
                                    value={tempObservation}
                                    onChange={(e) => setTempObservation(e.target.value)}
                                    placeholder="Ej: Sin hielo, Muy caliente, etc..."
                                    className="w-full px-6 py-5 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm min-h-[120px] resize-none"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setProductForObservation(null)}
                                    className="flex-1 py-5 bg-zinc-100 text-zinc-400 rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isAddingConsumption !== null}
                                    onClick={async () => {
                                        try {
                                            setIsAddingConsumption(productForObservation.id);
                                            const bookingId = (selectedBooking || selectedSpaceBooking)?.id;
                                            
                                            await api.post('/api/consumptions', {
                                                bookingId: bookingId,
                                                productId: productForObservation.id,
                                                quantity: 1,
                                                notes: tempObservation
                                            }, getAuthConfig());

                                            const consRes = await api.get(`/api/consumptions/booking/${bookingId}`, getAuthConfig());
                                            setBookingConsumptions(consRes.data || []);
                                            
                                            setProductForObservation(null);
                                            setIsConsumptionModalOpen(false);
                                        } catch (err: any) {
                                            console.error("Error al agregar:", err);
                                            alert("Error: " + (err.response?.data?.message || err.message));
                                        } finally {
                                            setIsAddingConsumption(null);
                                        }
                                    }}
                                    className="flex-[2] py-5 bg-black text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                                >
                                    {isAddingConsumption === productForObservation.id ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Confirmar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Éxito de Pago */}
            {/* Mixed Payment Modal */}
            {isMixedPaymentModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[110] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/10">
                        <div className="p-8 bg-zinc-900 text-white relative">
                            <button onClick={() => setIsMixedPaymentModalOpen(false)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-xl">
                                    <RefreshCw className="w-5 h-5 text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-black italic uppercase tracking-tight">Dividir Pago</h2>
                            </div>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Configuración de montos y medios de pago</p>
                        </div>

                        {(() => {
                            const booking = selectedBooking || selectedSpaceBooking;
                            if (!booking) return null;

                            // --- CÁLCULO DE TOTAL BASADO EN SELECCIONES GRANULARES ---
                            let transactionTotal = 0;

                            // 1. Renta Principal
                            const mainRentDebt = booking.price - (booking.depositPaid || 0);
                            const mainFractions = courtFractions[booking.id] || 1;
                            const mainSelectedParts = selectedCourtParts[booking.id] || [];
                            if (mainRentDebt > 0) transactionTotal += (mainRentDebt / mainFractions) * mainSelectedParts.length;

                            // 2. Canchas Relacionadas
                            relatedBookings.filter(rb => selectedRelatedBookingIds.includes(rb.id)).forEach(rb => {
                                const rbDebt = getTotalDebt(rb);
                                const rbFractions = courtFractions[rb.id] || 1;
                                const rbSelectedParts = selectedCourtParts[rb.id] || [];
                                if (rbDebt > 0) transactionTotal += (rbDebt / rbFractions) * rbSelectedParts.length;
                            });

                            // 3. Consumiciones Agrupadas
                            const grouped = (bookingConsumptions || []).filter(c => !c.isPaid).reduce((acc, c) => {
                                const pid = c.productId;
                                if (!acc[pid]) acc[pid] = { totalPrice: 0, totalDeposit: 0 };
                                acc[pid].totalPrice += (c.totalPrice || 0);
                                acc[pid].totalDeposit += (c.depositPaid || 0);
                                return acc;
                            }, {} as Record<number, any>);

                            Object.keys(grouped).forEach(pid => {
                                const groupKey = `group-${pid}`;
                                const partsCount = consumptionFractions[groupKey] || 1;
                                const selectedPartsCount = (selectedConsumptionParts[groupKey] || []).length;
                                const remaining = grouped[Number(pid)].totalPrice - grouped[Number(pid)].totalDeposit;
                                if (remaining > 0) transactionTotal += (remaining / partsCount) * selectedPartsCount;
                            });

                            return (
                                <div className="p-8 space-y-8">
                                    {/* Summary Header */}
                                    <div className="flex justify-between items-end bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                                        <div>
                                            <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest mb-1">TOTAL A DIVIDIR</p>
                                            <p className="text-3xl font-black italic text-black tracking-tighter">{formatARS(transactionTotal)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest mb-1">REMANENTE</p>
                                            <p className="text-xl font-black italic text-emerald-500 tracking-tighter">{formatARS(Math.max(0, transactionTotal - firstMethodAmount))}</p>
                                        </div>
                                    </div>

                                    {/* Amount Selection */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">
                                                Monto para {paymentMethods.find(m => m.id.toString() === selectedPaymentMethod)?.name || 'Medio 1'}
                                            </label>
                                            <div className="flex gap-1.5">
                                                {[0.25, 0.5, 0.75].map(p => (
                                                    <button 
                                                        key={p}
                                                        onClick={() => setFirstMethodAmount(transactionTotal * p)}
                                                        className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 rounded-full text-[8px] font-black text-zinc-600 transition-colors"
                                                    >
                                                        {p * 100}%
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-zinc-300 text-xl">$</span>
                                            <input
                                                type="number"
                                                value={firstMethodAmount}
                                                onChange={(e) => setFirstMethodAmount(Math.min(transactionTotal, Number(e.target.value)))}
                                                className="w-full pl-12 pr-6 py-6 bg-zinc-50 border border-zinc-100 rounded-[28px] focus:ring-8 focus:ring-black/5 outline-none font-black text-2xl tracking-tighter"
                                            />
                                        </div>
                                    </div>

                                    {/* Second Payment Method */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-zinc-900 uppercase tracking-widest ml-2">Segundo Medio de Pago</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {paymentMethods
                                                .filter(m => m.name !== "BONIFICADO / SIN COSTO")
                                                .map((m) => (
                                                <button
                                                    key={`second-modal-${m.id}`}
                                                    disabled={selectedPaymentMethod === m.id.toString()}
                                                    onClick={() => setSecondPaymentMethod(m.id.toString())}
                                                    className={`p-4 rounded-[24px] border transition-all text-[10px] font-black uppercase flex items-center justify-center gap-2 ${secondPaymentMethod === m.id.toString() ? 'bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/20' : 'bg-white border-zinc-100 hover:border-black/10 text-zinc-400'} ${selectedPaymentMethod === m.id.toString() ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${secondPaymentMethod === m.id.toString() ? 'bg-white' : 'bg-zinc-200'}`}></div>
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={() => {
                                                setIsMixedPayment(false);
                                                setIsMixedPaymentModalOpen(false);
                                            }}
                                            className="flex-1 py-5 bg-zinc-100 text-zinc-400 rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-colors"
                                        >
                                            Anular División
                                        </button>
                                        <button
                                            disabled={!secondPaymentMethod || firstMethodAmount <= 0 || firstMethodAmount >= transactionTotal}
                                            onClick={() => {
                                                setIsMixedPayment(true);
                                                setIsMixedPaymentModalOpen(false);
                                            }}
                                            className="flex-[2] py-5 bg-black text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-black/20 hover:bg-zinc-800 transition-all disabled:opacity-30"
                                        >
                                            Confirmar División
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
            {paymentSuccessInfo?.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-10 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
                                <Check className="w-10 h-10 text-white" />
                            </div>
                            
                            <h3 className="text-2xl font-black italic uppercase tracking-tight mb-2">
                                {paymentSuccessInfo.isPartial ? 'Cobro Parcial' : 'Cobro Finalizado'}
                            </h3>
                            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-8">Transacción completada con éxito</p>

                            <div className="w-full bg-zinc-50 rounded-3xl p-6 mb-8 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase">Monto Cobrado</span>
                                    <span className="text-lg font-black text-emerald-600">{formatARS(paymentSuccessInfo.amount)}</span>
                                </div>
                                {paymentSuccessInfo.isPartial && (
                                    <div className="flex justify-between items-center pt-4 border-t border-zinc-100">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase">Deuda Restante</span>
                                        <span className="text-lg font-black text-zinc-900">{formatARS(paymentSuccessInfo.remaining)}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    const wasPartial = paymentSuccessInfo.isPartial;
                                    setPaymentSuccessInfo(null);
                                    if (!wasPartial) {
                                        setIsDetailsModalOpen(false);
                                    }
                                }}
                                className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-black/20"
                            >
                                {paymentSuccessInfo.isPartial ? 'Continuar Cobrando' : 'Finalizar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Multi-Court Suggestion Modal */}
            {multiCourtSuggestion?.isOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[120] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/10">
                        <div className="p-8 bg-black text-white relative text-center">
                            <button onClick={() => setMultiCourtSuggestion(null)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                            <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight mb-2">¡Turno Reservado!</h2>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">¿Deseas alquilar otra cancha a la misma hora?</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100 flex items-center justify-center gap-6">
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">HORARIO</p>
                                    <p className="text-sm font-black italic">{format(parseISO(multiCourtSuggestion.startTime), 'HH:mm')} hs</p>
                                </div>
                                <div className="w-px h-8 bg-zinc-200"></div>
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">DURACIÓN</p>
                                    <p className="text-sm font-black italic">{multiCourtSuggestion.duration} min</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-900 uppercase tracking-widest ml-2">Selecciona Canchas Disponibles</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {courts
                                        .filter(c => c.id !== multiCourtSuggestion.originalCourtId)
                                        .map(c => {
                                            const start = parseISO(multiCourtSuggestion.startTime);
                                            const end = addMinutes(start, multiCourtSuggestion.duration);
                                            const isBusy = bookings.some(b => 
                                                b.courtId === c.id && 
                                                b.status !== 2 && 
                                                areIntervalsOverlapping(
                                                    { start: parseISO(b.startTime), end: parseISO(b.endTime) },
                                                    { start: start, end: end }
                                                )
                                            );

                                            if (isBusy) return null;

                                            return (
                                                <button
                                                    key={`extra-court-${c.id}`}
                                                    onClick={async () => {
                                                        try {
                                                            setLoading(true);
                                                            const payload = {
                                                                courtId: c.id,
                                                                guestName: multiCourtSuggestion.guestName || null,
                                                                guestPhone: multiCourtSuggestion.guestPhone || null,
                                                                guestEmail: multiCourtSuggestion.guestEmail || null,
                                                                dni: multiCourtSuggestion.guestDni || null,
                                                                userId: multiCourtSuggestion.bookingType === 'existing' ? multiCourtSuggestion.clientId : null,
                                                                startTime: multiCourtSuggestion.startTime,
                                                                durationMinutes: multiCourtSuggestion.duration,
                                                                isRecurring: false,
                                                                endDate: null,
                                                                price: (multiCourtSuggestion.duration / 60) * c.pricePerHour,
                                                                depositPaid: 0
                                                            };
                                                            await api.post('/api/bookings/admin-create', payload, config);
                                                            fetchData();
                                                            // No cerramos el modal, solo quitamos la cancha de la lista de sugerencias marcándola como "procesada"
                                                            // o simplemente dejando que el filtro isBusy actúe tras el fetchData.
                                                            // Pero como fetchData es asíncrono y los bookings tardan en actualizarse en el state local:
                                                            setBookings(prev => [...prev, { ...payload, id: 'temp-' + Date.now(), court: { name: c.name }, endTime: addMinutes(parseISO(payload.startTime), payload.durationMinutes).toISOString(), status: 1 } as any]);
                                                            alert(`¡Turno en ${c.name} reservado con éxito!`);
                                                        } catch (err: any) {
                                                            alert("Error: " + (err.response?.data || err.message));
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    }}
                                                    className="p-4 bg-white border border-zinc-100 rounded-[24px] hover:border-black hover:shadow-xl transition-all group flex flex-col items-center gap-1"
                                                >
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-black transition-colors">{c.name}</span>
                                                    <span className="text-[10px] font-black italic text-emerald-500">Disponible</span>
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            <button
                                onClick={() => setMultiCourtSuggestion(null)}
                                className="w-full py-5 bg-zinc-100 text-zinc-400 rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-colors"
                            >
                                No, terminar aquí
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingsPage;
