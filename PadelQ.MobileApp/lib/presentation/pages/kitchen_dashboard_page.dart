import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../data/services/reports_service.dart';

class KitchenDashboardPage extends ConsumerStatefulWidget {
  const KitchenDashboardPage({super.key});

  @override
  ConsumerState<KitchenDashboardPage> createState() => _KitchenDashboardPageState();
}

class _KitchenDashboardPageState extends ConsumerState<KitchenDashboardPage> {
  final ReportsService _reportsService = ReportsService();
  DateTime _startDate = DateTime.now().subtract(const Duration(days: 1));
  DateTime _endDate = DateTime.now();
  List<Map<String, dynamic>> _sales = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchSales();
  }

  Future<void> _fetchSales() async {
    setState(() => _isLoading = true);
    final sales = await _reportsService.getKitchenSales(_startDate, _endDate);
    if (mounted) {
      setState(() {
        _sales = sales ?? [];
        _isLoading = false;
      });
    }
  }

  Future<void> _selectDateRange(BuildContext context) async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: DateTimeRange(start: _startDate, end: _endDate),
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
            colorScheme: const ColorScheme.light(primary: Colors.black, onPrimary: Colors.white),
            buttonTheme: const ButtonThemeData(textTheme: ButtonTextTheme.primary),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _startDate = picked.start;
        _endDate = picked.end;
      });
      _fetchSales();
    }
  }

  @override
  Widget build(BuildContext context) {
    final double totalCollected = _sales.fold(0, (sum, item) => sum + (item['total'] ?? 0));

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: Text(
          'VENTAS COCINA',
          style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, letterSpacing: 2.w, fontStyle: FontStyle.italic),
        ),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Colors.black),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 5))],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'FECHAS',
                        style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 1.w),
                      ),
                      SizedBox(height: 4.h),
                      Text(
                        '${DateFormat('dd/MM').format(_startDate)} - ${DateFormat('dd/MM').format(_endDate)}',
                        style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.black),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => _selectDateRange(context),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(16.r),
                    ),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.calendar, color: Colors.white, size: 16),
                        SizedBox(width: 8.w),
                        Text(
                          'FILTRAR',
                          style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          Container(
            margin: EdgeInsets.all(24.w),
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(24.r),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 10))],
            ),
            child: Row(
              children: [
                Container(
                  padding: EdgeInsets.all(12.w),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(16.r),
                  ),
                  child: const Icon(LucideIcons.dollarSign, color: Colors.white),
                ),
                SizedBox(width: 16.w),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TOTAL RECAUDADO',
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      '\$${totalCollected.toStringAsFixed(2)}',
                      style: TextStyle(color: Colors.white, fontSize: 24.sp, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.black))
                : _sales.isEmpty
                    ? Center(
                        child: Text(
                          'No hay ventas en este período.',
                          style: TextStyle(color: Colors.grey.shade400, fontWeight: FontWeight.bold),
                        ),
                      )
                    : ListView.separated(
                        padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 8.h),
                        itemCount: _sales.length,
                        separatorBuilder: (context, index) => Divider(color: Colors.black.withOpacity(0.05)),
                        itemBuilder: (context, index) {
                          final sale = _sales[index];
                          return Padding(
                            padding: EdgeInsets.symmetric(vertical: 8.h),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        sale['productName'] ?? '',
                                        style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.black),
                                      ),
                                      SizedBox(height: 4.h),
                                      Text(
                                        sale['date'] ?? '',
                                        style: TextStyle(fontSize: 10.sp, color: Colors.grey.shade500, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  flex: 1,
                                  child: Text(
                                    'x${sale['quantity']}',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.bold, color: Colors.grey.shade600),
                                  ),
                                ),
                                Expanded(
                                  flex: 1,
                                  child: Text(
                                    '\$${sale['total']}',
                                    textAlign: TextAlign.right,
                                    style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.black, fontStyle: FontStyle.italic),
                                  ),
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
