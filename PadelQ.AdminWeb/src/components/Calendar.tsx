import React, { useMemo } from 'react';
import { format, parseISO, isSameDay, addHours, startOfHour } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  courtName: string;
  userName: string;
  status: string;
}

interface Court {
  id: number;
  name: string;
}

interface CalendarProps {
  bookings: Booking[];
  courts: Court[];
  selectedDate: Date;
}

const Calendar = ({ bookings, courts, selectedDate }: CalendarProps) => {
  const hours = Array.from({ length: 16 }, (_, i) => 8 + i); // 8:00 to 23:00

  const bookingsByCourt = useMemo(() => {
    const filtered = bookings.filter(b => isSameDay(parseISO(b.startTime), selectedDate));
    const map: Record<string, Booking[]> = {};
    courts.forEach(c => map[c.name] = []);
    filtered.forEach(b => {
      if (map[b.courtName]) map[b.courtName].push(b);
    });
    return map;
  }, [bookings, courts, selectedDate]);

  const getBookingAt = (courtName: string, hour: number) => {
    return bookingsByCourt[courtName]?.find(b => {
      const start = parseISO(b.startTime);
      return start.getHours() === hour;
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-xl font-bold text-slate-800">Agenda de Reservas</h2>
        <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 uppercase tracking-wider">
          {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header Row: Court Names */}
          <div className="grid" style={{ gridTemplateColumns: `100px repeat(${courts.length}, 1fr)` }}>
            <div className="p-4 bg-slate-50 border-b border-r border-slate-100 font-bold text-slate-400 text-xs uppercase tracking-widest flex items-center justify-center">
              HORARIO
            </div>
            {courts.map(court => (
              <div key={court.id} className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-center text-slate-700 text-sm uppercase tracking-wider">
                {court.name}
              </div>
            ))}
          </div>

          {/* Time Rows */}
          {hours.map(hour => (
            <div key={hour} className="grid" style={{ gridTemplateColumns: `100px repeat(${courts.length}, 1fr)` }}>
              {/* Hour Column */}
              <div className="p-4 border-r border-b border-slate-100 text-center font-bold text-slate-400 text-sm bg-slate-50/30 flex items-center justify-center">
                {`${hour}:00`}
              </div>

              {/* Court Columns */}
              {courts.map(court => {
                const booking = getBookingAt(court.name, hour);
                return (
                  <div key={`${court.id}-${hour}`} className="border-b border-slate-100 p-2 min-h-[80px] hover:bg-slate-50/50 transition-colors relative">
                    {booking && (
                      <div className={`h-full w-full rounded-xl p-3 text-xs shadow-sm border transaction-all duration-200 cursor-pointer ${
                        booking.status === 'Confirmed' 
                          ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        <p className="font-bold opacity-80 uppercase tracking-tighter mb-1">RESERVADO</p>
                        <p className="font-extrabold text-[13px] leading-tight truncate">{booking.userName}</p>
                        <div className="mt-2 flex items-center gap-1.5 opacity-70">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
                          <span>Status: {booking.status}</span>
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
  );
};

export default Calendar;
