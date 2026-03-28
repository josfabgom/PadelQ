import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../data/services/booking_service.dart';

class BookingPage extends StatefulWidget {
  const BookingPage({super.key});

  @override
  State<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends State<BookingPage> {
  final BookingService _service = BookingService();
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = const TimeOfDay(hour: 18, minute: 0);
  int _selectedDuration = 60;
  List<dynamic> _courts = [];
  List<dynamic> _myBookings = [];
  bool _isLoading = true;

  final List<TimeOfDay> _timeSlots = List.generate(15, (i) => TimeOfDay(hour: 8 + i, minute: 0));
  final List<int> _durations = [60, 90, 120];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final courts = await _service.getCourts();
    final myBookings = await _service.getMyBookings();
    setState(() {
      _courts = courts;
      _myBookings = myBookings;
      _isLoading = false;
    });
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime(2101),
      locale: const Locale('es', 'ES'),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _handleBooking(int courtId) async {
    final startTime = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day, _selectedTime.hour, _selectedTime.minute);
    
    final result = await _service.createBooking(courtId, startTime, _selectedDuration);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'])),
      );
      _loadData();
    }
  }

  Future<void> _handleCancel(String bookingId) async {
    final success = await _service.cancelBooking(bookingId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(success ? 'Reserva liberada' : 'Error al liberar')),
      );
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Reserva Centralizada', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [IconButton(icon: const Icon(LucideIcons.refreshCw), onPressed: _loadData)],
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : Column(
        children: [
          _buildDateHeader(),
          _buildTimeSlots(),
          _buildDurationPicker(),
          _buildMyBookingsSection(),
          _buildCourtsList(),
        ],
      ),
    );
  }

  Widget _buildDurationPicker() {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 8.h),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Duración del Turno', style: TextStyle(color: Colors.grey.shade500, fontSize: 13.sp)),
          SizedBox(height: 8.h),
          Wrap(
            spacing: 8.w,
            runSpacing: 8.h,
            children: _durations.map((d) {
              final isSelected = _selectedDuration == d;
              return ChoiceChip(
                label: Text('$d min'),
                selected: isSelected,
                onSelected: (val) => setState(() => _selectedDuration = d),
                selectedColor: Colors.green.shade600,
                labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black, fontWeight: FontWeight.bold),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeSlots() {
    return Container(
      padding: EdgeInsets.symmetric(vertical: 16.h, horizontal: 20.w),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Horarios Disponibles', style: TextStyle(color: Colors.grey.shade500, fontSize: 13.sp)),
          SizedBox(height: 12.h),
          Wrap(
            spacing: 8.w,
            runSpacing: 8.h,
            children: _timeSlots.map((slot) {
              final isSelected = _selectedTime.hour == slot.hour;
              return ChoiceChip(
                label: Text('${slot.hour.toString().padLeft(2, '0')}:00'),
                selected: isSelected,
                onSelected: (val) => setState(() => _selectedTime = slot),
                selectedColor: Colors.blue.shade700,
                labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black, fontSize: 12.sp),
                backgroundColor: Colors.grey.shade50,
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildDateHeader() {
    return Container(
      padding: EdgeInsets.all(20.w),
      color: Colors.white,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Fecha para Alquilar', style: TextStyle(color: Colors.grey.shade500, fontSize: 13.sp)),
              Text(DateFormat('dd MMMM, yyyy', 'es').format(_selectedDate), style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold)),
            ],
          ),
          ElevatedButton.icon(
            onPressed: () => _selectDate(context),
            icon: const Icon(LucideIcons.calendar),
            label: const Text('Elegir'),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue.shade700, foregroundColor: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _buildMyBookingsSection() {
    final active = _myBookings.where((b) => b['status'] != 2).toList(); // status 2 = cancelled (enum mapped to index? no, let's check)
    // En el backend 2 era Cancelled.
    if (active.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(left: 20.w, top: 16.h, bottom: 8.h),
          child: Text('Mis Reservas Activas', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold)),
        ),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.symmetric(horizontal: 20.w),
          itemCount: active.length,
          itemBuilder: (context, index) {
            final b = active[index];
            return Card(
              color: Colors.blue.shade50,
              elevation: 0,
              child: ListTile(
                title: Text('${b['court']['name']} - ${DateFormat('HH:mm').format(DateTime.parse(b['startTime']))}hs'),
                subtitle: const Text('Reservada correctamente'),
                trailing: TextButton(
                  onPressed: () => _handleCancel(b['id']),
                  child: const Text('LIBERAR', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildCourtsList() {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(left: 20.w, top: 16.h, bottom: 8.h),
            child: Text('Canchas Disponibles', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold)),
          ),
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.symmetric(horizontal: 20.w),
              itemCount: _courts.length,
              itemBuilder: (context, index) {
                final court = _courts[index];
                return Container(
                  margin: EdgeInsets.only(bottom: 12.h),
                  padding: EdgeInsets.all(16.w),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20.r)),
                  child: Row(
                    children: [
                      Icon(LucideIcons.armchair, color: Colors.blue.shade700),
                      SizedBox(width: 16.w),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(court['name'], style: TextStyle(fontWeight: FontWeight.bold)),
                            Text(court['courtType'] == 0 ? 'Vidrio' : 'Malla', style: TextStyle(color: Colors.grey, fontSize: 12.sp)),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        onPressed: () => _handleBooking(court['id']),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green.shade600,
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.symmetric(horizontal: 16.w),
                        ),
                        child: const Text('RESERVAR'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
