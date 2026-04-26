export const SYSTEM_VERSION = "3.5.0 LIVE";

export interface UpdateRecord {
    version: string;
    date: string;
    description: string;
    author: string;
}

export const UPDATE_HISTORY: UpdateRecord[] = [
    {
        version: "3.5.0 LIVE",
        date: "2026-04-22",
        description: "Gestión avanzada de Perfiles y Espacios: Implementación del rol 'Profesores' con acceso restringido a Actividades, rediseño de Dashboard operativo con métricas clave, y selector de visibilidad selectiva para espacios en calendario (Sí/No).",
        author: "Antigravity AI"
    },
    {
        version: "3.4.2 LIVE",
        date: "2026-04-21",
        description: "Optimización WhatsApp: Reutilización de pestañas para evitar abrir múltiples ventanas y mejora en la limpieza de números (remoción de 0 y 15) para evitar errores de envío.",
        author: "Antigravity AI"
    },
    {
        version: "3.4.1 LIVE",
        date: "2026-04-21",
        description: "Notificación inteligente: El sistema ahora ofrece automáticamente enviar el comprobante por WhatsApp apenas se termina de cargar una reserva, agilizando la confirmación al cliente.",
        author: "Antigravity AI"
    },
    {
        version: "3.4.0 LIVE",
        date: "2026-04-21",
        description: "Módulo WhatsApp: Nueva función de envío de recordatorios directos por WhatsApp desde el modal de reserva. Incluye formateo automático de mensajes y soporte para prefijos internacionales.",
        author: "Antigravity AI"
    },
    {
        version: "3.3.1 LIVE",
        date: "2026-04-21",
        description: "Diferenciación visual en calendario: Alquileres de espacios ahora usan un tono violeta intenso y canchas mantienen su paleta vibrante para una lectura rápida.",
        author: "Antigravity AI"
    },
    {
        version: "3.3.0 LIVE",
        date: "2026-04-21",
        description: "Estabilización de anulaciones: Confirmación por estados (sin pop-ups nativos), filtrado estricto de roles administrativos y usuarios inactivos en buscador, y herramientas de mantenimiento global (Wipe) habilitadas para Staff.",
        author: "Antigravity AI"
    },
    {
        version: "3.2.1 LIVE",
        date: "2026-04-21",
        description: "Corrección de errores en anulación de series recurrentes y sincronización de tipos para filtrado de clientes.",
        author: "Antigravity AI"
    },
    {
        version: "3.2.0 LIVE",
        date: "2026-04-20",
        description: "Implementación de anulación de series completas en backend y frontend. Integración de Bookings y SpaceBookings en herramientas de limpieza.",
        author: "Antigravity AI"
    },
    {
        version: "3.1.5 LIVE",
        date: "2026-04-19",
        description: "Mejora en la visualización del calendario: Indicador de hora actual y optimización de grilla compacta.",
        author: "Antigravity AI"
    },
    {
        version: "3.1.0 LIVE",
        date: "2026-04-18",
        description: "Integración de Espacios (Common Areas) en el calendario unificado de administración.",
        author: "Antigravity AI"
    },
    {
        version: "3.0.0 LIVE",
        date: "2026-04-16",
        description: "Lanzamiento inicial de PadelQ Admin Web con gestión de turnos y clientes.",
        author: "Dev Team"
    }
];
