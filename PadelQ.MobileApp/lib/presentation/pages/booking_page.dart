import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import '../../data/services/booking_service.dart';
import '../../config/api_config.dart';

class BookingPage extends ConsumerStatefulWidget {
  const BookingPage({super.key});

  @override
  ConsumerState<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends ConsumerState<BookingPage> {
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
    try {
      final courts = await _service.getCourts();
      final myBookings = await _service.getMyBookings();
      setState(() {
        _courts = courts;
        _myBookings = myBookings;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleBooking(int courtId) async {
    final startTime = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day, _selectedTime.hour, _selectedTime.minute);
    
    setState(() => _isLoading = true);
    final result = await _service.createBooking(courtId, startTime, _selectedDuration);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: result['success'] == true ? Colors.green : Colors.red,
          content: Text(result['message'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
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
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: Text('RESERVAS', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, letterSpacing: 2.w, color: Colors.black)),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(icon: const Icon(LucideIcons.chevronLeft, color: Colors.black), onPressed: () => context.pop()),
        actions: [IconButton(icon: const Icon(LucideIcons.refreshCw, size: 18), onPressed: _loadData)],
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: Colors.black))
        : Column(
        children: [
          _buildHorizontalCalendar(),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(bottom: 40.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   _buildSectionTitle('SELECCIONA EL HORARIO'),
                   _buildTimeSlots(),
                   _buildSectionTitle('DURACIÓN DEL TURNO'),
                   _buildDurationPicker(),
                   _buildMyBookingsSection(),
                   _buildSectionTitle('CANCHAS DISPONIBLES'),
                   _buildCourtsList(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: EdgeInsets.fromLTRB(24.w, 32.h, 24.w, 16.h),
      child: Text(
        title,
        style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 2.w),
      ),
    );
  }

  Widget _buildHorizontalCalendar() {
    return Container(
      height: 110.h,
      color: Colors.white,
      padding: EdgeInsets.symmetric(vertical: 16.h),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(horizontal: 20.w),
        itemCount: 14, // Next 2 weeks
        itemBuilder: (context, index) {
          final date = DateTime.now().add(Duration(days: index));
          final isSelected = DateUtils.isSameDay(_selectedDate, date);
          
          return GestureDetector(
            onTap: () => setState(() => _selectedDate = date),
            child: Container(
              width: 65.w,
              margin: EdgeInsets.only(right: 12.w),
              decoration: BoxDecoration(
                color: isSelected ? Colors.black : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(20.r),
                border: Border.all(color: isSelected ? Colors.black : Colors.black.withOpacity(0.03)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    DateFormat('E', 'es').format(date).toUpperCase(),
                    style: TextStyle(color: isSelected ? Colors.white.withOpacity(0.5) : Colors.grey.shade400, fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w),
                  ),
                  SizedBox(height: 6.h),
                  Text(
                    date.day.toString(),
                    style: TextStyle(color: isSelected ? Colors.white : Colors.black, fontSize: 18.sp, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildTimeSlots() {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 24.w),
      child: Wrap(
        spacing: 12.w,
        runSpacing: 12.h,
        children: _timeSlots.map((slot) {
          final isSelected = _selectedTime.hour == slot.hour;
          return GestureDetector(
            onTap: () => setState(() => _selectedTime = slot),
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 14.h),
              decoration: BoxDecoration(
                color: isSelected ? Colors.black : Colors.white,
                borderRadius: BorderRadius.circular(16.r),
                border: Border.all(color: isSelected ? Colors.black : Colors.black.withOpacity(0.05)),
              ),
              child: Text(
                '${slot.hour.toString().padLeft(2, '0')}:00',
                style: TextStyle(color: isSelected ? Colors.white : Colors.black, fontSize: 12.sp, fontWeight: FontWeight.w900),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDurationPicker() {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 24.w),
      child: Row(
        children: _durations.map((d) {
          final isSelected = _selectedDuration == d;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedDuration = d),
              child: Container(
                margin: EdgeInsets.only(right: d != 120 ? 12.w : 0),
                padding: EdgeInsets.symmetric(vertical: 16.h),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.black : Colors.white,
                  borderRadius: BorderRadius.circular(16.r),
                  border: Border.all(color: isSelected ? Colors.black : Colors.black.withOpacity(0.05)),
                ),
                child: Center(
                  child: Text(
                    '$d MIN',
                    style: TextStyle(color: isSelected ? Colors.white : Colors.black, fontSize: 11.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildMyBookingsSection() {
    final active = _myBookings.where((b) => b['status'] != 2).toList();
    if (active.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('MIS RESERVAS'),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.symmetric(horizontal: 24.w),
          itemCount: active.length,
          itemBuilder: (context, index) {
            final b = active[index];
            final date = DateTime.parse(b['startTime']);
            return Container(
              margin: EdgeInsets.only(bottom: 12.h),
              padding: EdgeInsets.all(20.w),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(24.r),
                border: Border.all(color: Colors.green.withOpacity(0.1)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(12.w),
                    decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(16.r)),
                    child: const Icon(LucideIcons.calendarCheck, color: Colors.white, size: 20),
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b['court']['name'], style: TextStyle(fontWeight: FontWeight.w900, color: Colors.green.shade900)),
                        Text('${DateFormat('dd/MM').format(date)} - ${DateFormat('HH:mm').format(date)}HS', style: TextStyle(color: Colors.green.shade700, fontSize: 11.sp, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => _handleCancel(b['id']),
                    child: Text('LIBERAR', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w900, fontSize: 10.sp, letterSpacing: 1.w)),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildCourtsList() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.symmetric(horizontal: 24.w),
      itemCount: _courts.length,
      itemBuilder: (context, index) {
        final court = _courts[index];
        return Container(
          margin: EdgeInsets.only(bottom: 16.h),
          padding: EdgeInsets.all(24.w),
          decoration: BoxDecoration(
            color: Colors.white, 
            borderRadius: BorderRadius.circular(28.r),
            border: Border.all(color: Colors.black.withOpacity(0.04)),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 5))],
          ),
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(court['name'], style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18.sp, fontStyle: FontStyle.italic)),
                  SizedBox(height: 4.h),
                  Text(
                    court['courtType'] == 0 ? 'CRISTAL PANORÁMICO' : 'MURO PROFESIONAL', 
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w)
                  ),
                ],
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: () => _handleBooking(court['id']),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                  padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
                  elevation: 0,
                ),
                child: Text('RESERVAR', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 2.w)),
              ),
            ],
          ),
        );
      },
    );
  }
}

extension PaddingExtension on Widget {
  Widget paddingRight(double value) => Padding(padding: EdgeInsets.only(right: value), child: this);
}
