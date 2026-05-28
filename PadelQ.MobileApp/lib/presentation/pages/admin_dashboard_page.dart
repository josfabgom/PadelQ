import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../data/services/admin_service.dart';

class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final AdminService _adminService = AdminService();
  final TextEditingController _searchController = TextEditingController();

  bool _isLoadingSales = true;
  bool _isLoadingCash = true;
  bool _isLoadingStock = true;
  bool _isLoadingBookings = true;
  Map<String, dynamic>? _salesSummary;
  Map<String, dynamic>? _cashStatus;
  List<dynamic> _products = [];
  List<dynamic> _stockAlerts = [];
  List<dynamic> _filteredProducts = [];
  List<dynamic> _todayBookings = [];
  List<dynamic> _todaySpaceBookings = [];
  final Map<String, Map<String, dynamic>> _selectedToOrder = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      setState(() {});
    });
    _loadData();
    _searchController.addListener(() {
      _filterProducts(_searchController.text);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _filterProducts(String query) {
    setState(() {
      if (query.isEmpty) {
        _filteredProducts = _products;
      } else {
        _filteredProducts = _products.where((p) {
          final name = (p['name'] ?? '').toString().toLowerCase();
          final category = (p['category'] ?? '').toString().toLowerCase();
          return name.contains(query.toLowerCase()) || category.contains(query.toLowerCase());
        }).toList();
      }
    });
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoadingSales = true;
      _isLoadingCash = true;
      _isLoadingStock = true;
      _isLoadingBookings = true;
    });

    try {
      final today = DateTime.now();
      final salesData = await _adminService.getReportsSummary();
      final cashData = await _adminService.getCashStatus();
      final alertsData = await _adminService.getStockAlerts();
      final productsData = await _adminService.getProducts();
      final bookingsData = await _adminService.getBookingsByDate(today);
      final spaceBookingsData = await _adminService.getSpaceBookingsByDate(today);

      setState(() {
        _salesSummary = salesData;
        _cashStatus = cashData;
        _stockAlerts = alertsData;
        _products = productsData;
        _filteredProducts = productsData;
        _todayBookings = bookingsData;
        _todaySpaceBookings = spaceBookingsData;
        _isLoadingSales = false;
        _isLoadingCash = false;
        _isLoadingStock = false;
        _isLoadingBookings = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingSales = false;
        _isLoadingCash = false;
        _isLoadingStock = false;
        _isLoadingBookings = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al cargar datos del panel')),
        );
      }
    }
  }

  void _addToOrder(Map<String, dynamic> product, int quantity) {
    setState(() {
      final String name = product['name'] ?? 'Producto';
      _selectedToOrder[name] = {
        'product': product,
        'quantity': quantity,
      };
    });
  }

  void _updateOrderQuantity(String name, int quantity) {
    setState(() {
      if (quantity <= 0) {
        _selectedToOrder.remove(name);
      } else {
        if (_selectedToOrder.containsKey(name)) {
          _selectedToOrder[name]!['quantity'] = quantity;
        }
      }
    });
  }

  void _clearOrder() {
    setState(() {
      _selectedToOrder.clear();
    });
  }

  void _copyOrderToClipboard() {
    if (_selectedToOrder.isEmpty) return;

    final StringBuffer buffer = StringBuffer();
    final todayStr = DateFormat('dd/MM/yyyy').format(DateTime.now());
    buffer.writeln('📝 *PEDIDO DE STOCK - PADELQ*');
    buffer.writeln('Fecha: $todayStr');
    buffer.writeln('');

    double totalEstimate = 0.0;
    _selectedToOrder.forEach((name, data) {
      final int qty = data['quantity'] ?? 0;
      final product = data['product'] as Map<String, dynamic>;
      final String category = product['category'] ?? 'General';
      final double price = (product['finalPrice'] ?? product['price'] ?? 0.0).toDouble();
      final double itemTotal = price * qty;
      totalEstimate += itemTotal;

      buffer.writeln('• $name (${category.toUpperCase()}): $qty uds. (Est: \$${NumberFormat('#,##0', 'es_AR').format(price)} c/u)');
    });

    buffer.writeln('');
    buffer.writeln('Total estimado: \$${NumberFormat('#,##0', 'es_AR').format(totalEstimate)}');

    Clipboard.setData(ClipboardData(text: buffer.toString()));

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('¡Pedido copiado al portapapeles! Listo para enviar.'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _showOrderBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final items = _selectedToOrder.entries.toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(32.r),
                  topRight: Radius.circular(32.r),
                ),
              ),
              padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 48.w,
                      height: 5.h,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(10.r),
                      ),
                    ),
                  ),
                  SizedBox(height: 24.h),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '📝 LISTADO DEL PEDIDO',
                        style: TextStyle(
                          fontSize: 14.sp,
                          fontWeight: FontWeight.w900,
                          color: Colors.black,
                          letterSpacing: 1.w,
                        ),
                      ),
                      Text(
                        '${items.length} ítems',
                        style: TextStyle(
                          fontSize: 12.sp,
                          color: Colors.grey.shade400,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 16.h),
                  Expanded(
                    child: items.isEmpty
                        ? Center(
                            child: Text(
                              'El pedido está vacío',
                              style: TextStyle(color: Colors.grey.shade400, fontSize: 13.sp),
                            ),
                          )
                        : ListView.builder(
                            itemCount: items.length,
                            itemBuilder: (context, index) {
                              final entry = items[index];
                              final String name = entry.key;
                              final int qty = entry.value['quantity'] ?? 0;
                              final product = entry.value['product'] as Map<String, dynamic>;
                              final String category = product['category'] ?? 'General';
                              final double price = (product['finalPrice'] ?? product['price'] ?? 0.0).toDouble();

                              return Container(
                                margin: EdgeInsets.only(bottom: 12.h),
                                padding: EdgeInsets.all(16.w),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(20.r),
                                  border: Border.all(color: Colors.black.withOpacity(0.03)),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            name,
                                            style: TextStyle(
                                              fontSize: 12.sp,
                                              fontWeight: FontWeight.w900,
                                              color: Colors.black,
                                            ),
                                          ),
                                          SizedBox(height: 4.h),
                                          Row(
                                            children: [
                                              Text(
                                                category.toUpperCase(),
                                                style: TextStyle(
                                                  fontSize: 8.sp,
                                                  color: Colors.grey.shade500,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                              SizedBox(width: 8.w),
                                              Text(
                                                '\$${NumberFormat('#,##0', 'es_AR').format(price)} c/u',
                                                style: TextStyle(
                                                  fontSize: 9.sp,
                                                  color: Colors.grey.shade600,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        GestureDetector(
                                          onTap: () {
                                            setModalState(() {
                                              _updateOrderQuantity(name, qty - 1);
                                            });
                                            setState(() {});
                                          },
                                          child: Container(
                                            padding: EdgeInsets.all(6.r),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              shape: BoxShape.circle,
                                              border: Border.all(color: Colors.black.withOpacity(0.05)),
                                            ),
                                            child: Icon(LucideIcons.minus, size: 12.sp, color: Colors.black),
                                          ),
                                        ),
                                        SizedBox(width: 10.w),
                                        Text(
                                          '$qty',
                                          style: TextStyle(
                                            fontSize: 14.sp,
                                            fontWeight: FontWeight.w900,
                                            color: Colors.black,
                                          ),
                                        ),
                                        SizedBox(width: 10.w),
                                        GestureDetector(
                                          onTap: () {
                                            setModalState(() {
                                              _updateOrderQuantity(name, qty + 1);
                                            });
                                            setState(() {});
                                          },
                                          child: Container(
                                            padding: EdgeInsets.all(6.r),
                                            decoration: BoxDecoration(
                                              color: Colors.black,
                                              shape: BoxShape.circle,
                                            ),
                                            child: Icon(LucideIcons.plus, size: 12.sp, color: Colors.white),
                                          ),
                                        ),
                                      ],
                                    ),
                                    SizedBox(width: 12.w),
                                    GestureDetector(
                                      onTap: () {
                                        setModalState(() {
                                          _updateOrderQuantity(name, 0);
                                        });
                                        setState(() {});
                                      },
                                      child: Icon(LucideIcons.trash2, color: Colors.red.shade400, size: 18.sp),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                  SizedBox(height: 16.h),
                  if (items.isNotEmpty) ...[
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              setModalState(() {
                                _clearOrder();
                              });
                              setState(() {});
                              Navigator.pop(context);
                            },
                            icon: const Icon(LucideIcons.trash2, color: Colors.red),
                            label: const Text('VACIAR'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red,
                              side: const BorderSide(color: Colors.red),
                              padding: EdgeInsets.symmetric(vertical: 14.h),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16.r),
                              ),
                            ),
                          ),
                        ),
                        SizedBox(width: 16.w),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              _copyOrderToClipboard();
                              Navigator.pop(context);
                            },
                            icon: const Icon(LucideIcons.copy, color: Colors.white),
                            label: const Text('COPIAR PEDIDO'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.black,
                              foregroundColor: Colors.white,
                              padding: EdgeInsets.symmetric(vertical: 14.h),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16.r),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildOrderFloatingBar() {
    int totalCount = 0;
    _selectedToOrder.forEach((_, data) {
      totalCount += (data['quantity'] as int? ?? 0);
    });

    return GestureDetector(
      onTap: _showOrderBottomSheet,
      child: Container(
        height: 56.h,
        margin: EdgeInsets.symmetric(horizontal: 24.w),
        padding: EdgeInsets.symmetric(horizontal: 20.w),
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(28.r),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(6.r),
              decoration: const BoxDecoration(
                color: Colors.amber,
                shape: BoxShape.circle,
              ),
              child: Text(
                '$totalCount',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 11.sp,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            SizedBox(width: 12.w),
            Text(
              'PEDIDO DE COMPRA ACTIVO',
              style: TextStyle(
                color: Colors.white,
                fontSize: 11.sp,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.w,
              ),
            ),
            const Spacer(),
            Text(
              'VER DETALLE',
              style: TextStyle(
                color: Colors.amber,
                fontSize: 10.sp,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(width: 4.w),
            Icon(LucideIcons.chevronUp, color: Colors.amber, size: 14.sp),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'PANEL DE CONTROL',
          style: TextStyle(
            fontSize: 14.sp,
            fontWeight: FontWeight.w900,
            letterSpacing: 2.w,
            color: Colors.black,
            fontStyle: FontStyle.italic,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft, color: Colors.black),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, color: Colors.black, size: 20),
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.black,
          labelColor: Colors.black,
          unselectedLabelColor: Colors.grey,
          labelStyle: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 0.5.w),
          tabs: const [
            Tab(text: 'VENTAS DIARIAS'),
            Tab(text: 'CAJA DIARIA'),
            Tab(text: 'CONTROL STOCK'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildSalesTab(),
          _buildCashTab(),
          _buildStockTab(),
        ],
      ),
      floatingActionButton: _tabController.index == 2 && _selectedToOrder.isNotEmpty
          ? _buildOrderFloatingBar()
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildSalesTab() {
    if (_isLoadingSales) {
      return const Center(child: CircularProgressIndicator(color: Colors.black));
    }

    if (_salesSummary == null) {
      return _buildErrorState();
    }

    final todayRevenue = _salesSummary!['todayRevenue'] ?? 0.0;
    final rentals = _salesSummary!['todayRentalsRevenue'] ?? 0.0;
    final consumptions = _salesSummary!['todayConsumptionsRevenue'] ?? 0.0;
    final payments = _salesSummary!['todayActualPayments'] ?? 0.0;
    final bookings = _salesSummary!['todayBookings'] ?? 0;

    return RefreshIndicator(
      onRefresh: _loadData,
      color: Colors.black,
      child: ListView(
        padding: EdgeInsets.all(24.w),
        children: [
          // Row of main metrics
          _buildMetricCard(
            title: 'INGRESOS TOTALES HOY',
            value: '\$${NumberFormat('#,##0.00', 'es_AR').format(todayRevenue)}',
            subtitle: 'Alquileres + Consumiciones',
            icon: LucideIcons.trendingUp,
            color: Colors.green.shade700,
          ),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(
                child: _buildMiniMetricCard(
                  title: 'ALQUILERES',
                  value: '\$${NumberFormat('#,##0', 'es_AR').format(rentals)}',
                  icon: LucideIcons.calendar,
                  color: Colors.blue.shade700,
                ),
              ),
              SizedBox(width: 16.w),
              Expanded(
                child: _buildMiniMetricCard(
                  title: 'CANTINA/CONSUMOS',
                  value: '\$${NumberFormat('#,##0', 'es_AR').format(consumptions)}',
                  icon: LucideIcons.shoppingBag,
                  color: Colors.orange.shade700,
                ),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(
                child: _buildMiniMetricCard(
                  title: 'COBROS EN CAJA',
                  value: '\$${NumberFormat('#,##0', 'es_AR').format(payments)}',
                  icon: LucideIcons.wallet,
                  color: Colors.purple.shade700,
                  tooltip: 'Flujo neto de transacciones procesadas hoy',
                ),
              ),
              SizedBox(width: 16.w),
              Expanded(
                child: _buildMiniMetricCard(
                  title: 'RESERVAS DEL DÍA',
                  value: '$bookings',
                  icon: LucideIcons.checkSquare,
                  color: Colors.teal.shade700,
                ),
              ),
            ],
          ),
          SizedBox(height: 24.h),

          // Title Section: Reservas de Hoy
          Text(
            'DETALLE DE RESERVAS DE HOY',
            style: TextStyle(
              fontSize: 10.sp,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade400,
              letterSpacing: 2.w,
            ),
          ),
          SizedBox(height: 16.h),

          _buildTodayBookingsList(),
        ],
      ),
    );
  }

  Widget _buildTodayBookingsList() {
    if (_isLoadingBookings) {
      return const Center(child: CircularProgressIndicator(color: Colors.black));
    }

    final allTodayBookings = <Map<String, dynamic>>[];
    for (var b in _todayBookings) {
      allTodayBookings.add({
        'type': 'Cancha',
        'resourceName': b['court']?['name'] ?? 'Cancha',
        'startTime': b['startTime'],
        'endTime': b['endTime'],
        'customerName': b['guestName'] ?? b['user']?['fullName'] ?? b['user']?['FullName'] ?? 'Particular',
        'price': (b['price'] ?? 0.0).toDouble(),
        'status': b['status'],
      });
    }
    for (var b in _todaySpaceBookings) {
      allTodayBookings.add({
        'type': 'Espacio',
        'resourceName': b['space']?['name'] ?? 'Salón',
        'startTime': b['startTime'],
        'endTime': b['endTime'],
        'customerName': b['guestName'] ?? b['user']?['fullName'] ?? b['user']?['FullName'] ?? 'Particular',
        'price': (b['price'] ?? 0.0).toDouble(),
        'status': b['status'],
      });
    }

    // Sort chronologically by startTime
    allTodayBookings.sort((a, b) => (a['startTime'] ?? '').compareTo(b['startTime'] ?? ''));

    if (allTodayBookings.isEmpty) {
      return Container(
        padding: EdgeInsets.all(24.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24.r),
          border: Border.all(color: Colors.black.withOpacity(0.05)),
        ),
        child: Center(
          child: Text(
            'No hay reservas registradas para hoy.',
            style: TextStyle(color: Colors.grey.shade400, fontSize: 12.sp, fontWeight: FontWeight.bold),
          ),
        ),
      );
    }

    return Column(
      children: allTodayBookings.map((tx) {
        final String type = tx['type'];
        final String resourceName = tx['resourceName'];
        final String customerName = tx['customerName'];
        final double price = tx['price'];
        final dynamic rawStatus = tx['status'];
        final String startTimeRaw = tx['startTime'] ?? '';
        final String endTimeRaw = tx['endTime'] ?? '';

        String timeStr = '';
        try {
          final start = DateTime.parse(startTimeRaw).toLocal();
          final end = DateTime.parse(endTimeRaw).toLocal();
          timeStr = "${DateFormat('HH:mm').format(start)} - ${DateFormat('HH:mm').format(end)}";
        } catch (e) {
          timeStr = '--:--';
        }

        // Map status
        String statusText = 'CONFIRMADO';
        Color statusColor = Colors.blue.shade700;

        if (rawStatus == 0 || rawStatus == 'Pending') {
          statusText = 'PENDIENTE';
          statusColor = Colors.orange.shade700;
        } else if (rawStatus == 1 || rawStatus == 'Confirmed') {
          statusText = 'CONFIRMADO';
          statusColor = Colors.blue.shade700;
        } else if (rawStatus == 2 || rawStatus == 'Cancelled') {
          statusText = 'CANCELADO';
          statusColor = Colors.red.shade700;
        } else if (rawStatus == 3 || rawStatus == 'NoShow') {
          statusText = 'AUSENTE';
          statusColor = Colors.grey.shade600;
        } else if (rawStatus == 4 || rawStatus == 'Paid') {
          statusText = 'PAGADO';
          statusColor = Colors.green.shade700;
        }

        return Container(
          margin: EdgeInsets.only(bottom: 12.h),
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20.r),
            border: Border.all(color: Colors.black.withOpacity(0.04)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            customerName,
                            style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: Colors.black),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        SizedBox(width: 8.w),
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                          decoration: BoxDecoration(
                            color: type == 'Cancha' ? Colors.blue.shade50 : Colors.purple.shade50,
                            borderRadius: BorderRadius.circular(4.r),
                          ),
                          child: Text(
                            type.toUpperCase(),
                            style: TextStyle(
                              fontSize: 8.sp,
                              color: type == 'Cancha' ? Colors.blue.shade700 : Colors.purple.shade700,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 4.h),
                    Row(
                      children: [
                        Icon(LucideIcons.clock, size: 12.sp, color: Colors.grey.shade400),
                        SizedBox(width: 4.w),
                        Text(
                          "$timeStr  ($resourceName)",
                          style: TextStyle(fontSize: 11.sp, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              SizedBox(width: 12.w),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '\$${NumberFormat('#,##0', 'es_AR').format(price)}',
                    style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w900, color: Colors.black),
                  ),
                  SizedBox(height: 4.h),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(6.r),
                    ),
                    child: Text(
                      statusText,
                      style: TextStyle(fontSize: 8.sp, color: statusColor, fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCashTab() {
    if (_isLoadingCash) {
      return const Center(child: CircularProgressIndicator(color: Colors.black));
    }

    if (_cashStatus == null) {
      return _buildErrorState();
    }

    final activeClosure = _cashStatus!['activeClosure'];
    final summary = _cashStatus!['summary'] as List<dynamic>? ?? [];
    final totalAmount = _cashStatus!['totalAmount'] ?? 0.0;
    final lastClosureDateRaw = _cashStatus!['lastClosureDate'];

    final bool isOpen = activeClosure != null && activeClosure['isOpen'] == true;
    final String cashier = isOpen ? (activeClosure['openedBy'] ?? 'Admin') : 'Ninguno';
    final double initialCash = isOpen ? (activeClosure['initialCash'] ?? 0.0) : 0.0;
    
    // Extract all transactions from summary categories for easy viewing
    final allTransactions = <Map<String, dynamic>>[];
    for (var category in summary) {
      final transList = category['transactions'] as List<dynamic>? ?? [];
      final methodName = category['method'] ?? 'No Especificado';
      final methodColor = category['color'] ?? '#888888';
      for (var t in transList) {
        allTransactions.add({
          ...t as Map<String, dynamic>,
          'method': methodName,
          'color': methodColor,
        });
      }
    }
    // Sort transactions by date descending
    allTransactions.sort((a, b) => (b['date'] ?? '').compareTo(a['date'] ?? ''));

    return RefreshIndicator(
      onRefresh: _loadData,
      color: Colors.black,
      child: ListView(
        padding: EdgeInsets.all(24.w),
        children: [
          // Active Cash closure status card
          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24.r),
              border: Border.all(color: Colors.black.withOpacity(0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'SESIÓN DE CAJA ACTIVA',
                      style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 1.5.w),
                    ),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
                      decoration: BoxDecoration(
                        color: isOpen ? Colors.green.shade50.withOpacity(0.9) : Colors.red.shade50.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(12.r),
                        border: Border.all(color: isOpen ? Colors.green.shade200 : Colors.red.shade200),
                      ),
                      child: Text(
                        isOpen ? 'ABIERTA' : 'CERRADA',
                        style: TextStyle(
                          color: isOpen ? Colors.green.shade800 : Colors.red.shade800,
                          fontSize: 10.sp,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 20.h),
                _buildClosureDetailRow('Cajero Responsable', cashier, LucideIcons.user),
                SizedBox(height: 12.h),
                _buildClosureDetailRow(
                  'Fecha de Apertura',
                  isOpen && activeClosure['openingDate'] != null
                      ? DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(activeClosure['openingDate']).toLocal())
                      : 'N/A',
                  LucideIcons.calendar,
                ),
                SizedBox(height: 12.h),
                _buildClosureDetailRow('Efectivo Inicial', '\$${NumberFormat('#,##0.00', 'es_AR').format(initialCash)}', LucideIcons.banknote),
                SizedBox(height: 12.h),
                _buildClosureDetailRow('Monto Total Cobrado', '\$${NumberFormat('#,##0.00', 'es_AR').format(totalAmount)}', LucideIcons.coins),
              ],
            ),
          ),
          SizedBox(height: 24.h),

          // Payment methods details header
          Text(
            'COBROS POR MEDIO DE PAGO',
            style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 2.w),
          ),
          SizedBox(height: 16.h),

          // Horizontal view or grid of payment methods
          ...summary.map((category) {
            final String method = category['method'] ?? '';
            final double total = (category['total'] ?? 0.0).toDouble();
            final int count = category['count'] ?? 0;
            final String hexColor = category['color'] ?? '#888888';
            final Color color = _parseHexColor(hexColor);

            if (total == 0 && count == 0) return const SizedBox.shrink();

            return Container(
              margin: EdgeInsets.only(bottom: 12.h),
              padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20.r),
                border: Border.all(color: Colors.black.withOpacity(0.04)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 12.w,
                    height: 36.h,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(6.r),
                    ),
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          method.toUpperCase(),
                          style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w900, color: Colors.black),
                        ),
                        SizedBox(height: 2.h),
                        Text(
                          '$count transacciones',
                          style: TextStyle(fontSize: 10.sp, color: Colors.grey.shade400, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '\$${NumberFormat('#,##0.00', 'es_AR').format(total)}',
                    style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.black),
                  ),
                ],
              ),
            );
          }),

          SizedBox(height: 24.h),

          // Transactions list header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ÚLTIMAS TRANSACCIONES',
                style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 2.w),
              ),
              Text(
                '${allTransactions.length} registros',
                style: TextStyle(fontSize: 9.sp, color: Colors.grey.shade400, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          SizedBox(height: 16.h),

          if (allTransactions.isEmpty)
            Container(
              padding: EdgeInsets.all(32.w),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24.r),
                border: Border.all(color: Colors.black.withOpacity(0.05)),
              ),
              child: Center(
                child: Text(
                  'No hay transacciones registradas hoy.',
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 13.sp),
                ),
              ),
            )
          else
            ...allTransactions.map((tx) {
              final double amount = (tx['amount'] ?? 0.0).toDouble();
              final String description = tx['description'] ?? 'Sin descripción';
              final String userName = tx['userName'] ?? 'Particular';
              final String method = tx['method'] ?? 'Efectivo';
              final String time = tx['date'] != null
                  ? DateFormat('HH:mm').format(DateTime.parse(tx['date']).toLocal())
                  : '--:--';
              final String processedBy = tx['processedBy'] ?? 'Admin';
              final Color methodColor = _parseHexColor(tx['color']);

              final bool isPositive = amount >= 0;

              return Container(
                margin: EdgeInsets.only(bottom: 12.h),
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20.r),
                  border: Border.all(color: Colors.black.withOpacity(0.04)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 8.r,
                      height: 48.r,
                      decoration: BoxDecoration(
                        color: methodColor,
                        borderRadius: BorderRadius.circular(4.r),
                      ),
                    ),
                    SizedBox(width: 16.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                userName,
                                style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: Colors.black),
                              ),
                              const Spacer(),
                              Text(
                                time,
                                style: TextStyle(fontSize: 10.sp, color: Colors.grey.shade400, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          SizedBox(height: 4.h),
                          Text(
                            description,
                            style: TextStyle(fontSize: 11.sp, color: Colors.grey.shade600),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: 4.h),
                          Row(
                            children: [
                              Container(
                                padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(4.r),
                                ),
                                child: Text(
                                  method.toUpperCase(),
                                  style: TextStyle(fontSize: 8.sp, color: Colors.grey.shade500, fontWeight: FontWeight.bold),
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Text(
                                'por: $processedBy',
                                style: TextStyle(fontSize: 8.sp, color: Colors.grey.shade400),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: 16.w),
                    Text(
                      '${isPositive ? '+' : ''}\$${NumberFormat('#,##0.00', 'es_AR').format(amount)}',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.w900,
                        color: isPositive ? Colors.green.shade700 : Colors.red.shade700,
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: EdgeInsets.all(24.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: Colors.black.withOpacity(0.05)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 1.5.w),
                ),
                SizedBox(height: 8.h),
                Text(
                  value,
                  style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w900, color: color, fontStyle: FontStyle.italic),
                ),
                SizedBox(height: 4.h),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 10.sp, color: Colors.grey.shade400),
                ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 28.sp),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    String? tooltip,
  }) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: Colors.black.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 0.8.w),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(icon, color: color.withOpacity(0.8), size: 16.sp),
            ],
          ),
          SizedBox(height: 12.h),
          Text(
            value,
            style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: Colors.black),
          ),
          if (tooltip != null) ...[
            SizedBox(height: 4.h),
            Text(
              tooltip,
              style: TextStyle(fontSize: 8.sp, color: Colors.grey.shade400),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildClosureDetailRow(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.grey.shade400, size: 16.sp),
        SizedBox(width: 12.w),
        Text(
          label,
          style: TextStyle(fontSize: 12.sp, color: Colors.grey.shade600),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold, color: Colors.black),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(24.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.alertCircle, color: Colors.red.shade400, size: 48.sp),
            SizedBox(height: 16.h),
            Text(
              'No se pudieron cargar los datos',
              style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8.h),
            Text(
              'Verifica que tu sesión tenga permisos de Administrador.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade500),
            ),
            SizedBox(height: 24.h),
            ElevatedButton(
              onPressed: _loadData,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              ),
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStockTab() {
    if (_isLoadingStock) {
      return const Center(child: CircularProgressIndicator(color: Colors.black));
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: Colors.black,
      child: ListView(
        padding: EdgeInsets.all(24.w),
        children: [
          // Section 1: Stock Alerts / Reorders (Quiebre de Stock)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ALERTAS DE COMPRA (QUIEBRE DE STOCK)',
                style: TextStyle(
                  fontSize: 10.sp,
                  fontWeight: FontWeight.w900,
                  color: Colors.grey.shade400,
                  letterSpacing: 1.5.w,
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                decoration: BoxDecoration(
                  color: _stockAlerts.isEmpty ? Colors.green.shade50 : Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10.r),
                ),
                child: Text(
                  _stockAlerts.isEmpty ? 'TODO OK' : '${_stockAlerts.length} COMPRAS',
                  style: TextStyle(
                    fontSize: 8.sp,
                    fontWeight: FontWeight.w900,
                    color: _stockAlerts.isEmpty ? Colors.green.shade700 : Colors.red.shade700,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 16.h),

          if (_stockAlerts.isEmpty)
            Container(
              padding: EdgeInsets.all(24.w),
              decoration: BoxDecoration(
                color: Colors.green.shade50.withOpacity(0.5),
                borderRadius: BorderRadius.circular(24.r),
                border: Border.all(color: Colors.green.shade100),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.checkSquare, color: Colors.green.shade700, size: 24.sp),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'STOCK EN NIVELES ÓPTIMOS',
                          style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: Colors.green.shade900),
                        ),
                        SizedBox(height: 2.h),
                        Text(
                          'Ningún producto activo se encuentra por debajo de su stock mínimo o proyección de ventas.',
                          style: TextStyle(fontSize: 10.sp, color: Colors.green.shade700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else
            ..._stockAlerts.map((alert) {
              final String name = alert['name'] ?? 'Producto';
              final String category = alert['category'] ?? 'General';
              final int stock = alert['stock'] ?? 0;
              final int minStock = alert['minimumStock'] ?? 0;
              final int weeklySales = alert['weeklySales'] ?? 0;
              final int needed = alert['needed'] ?? 0;

              return Container(
                margin: EdgeInsets.only(bottom: 12.h),
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20.r),
                  border: Border.all(color: Colors.red.shade100),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.red.shade50.withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name.toUpperCase(),
                                style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w900, color: Colors.black),
                              ),
                              SizedBox(height: 2.h),
                              Text(
                                category.toUpperCase(),
                                style: TextStyle(fontSize: 9.sp, color: Colors.grey.shade400, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                        (() {
                          final bool isInOrder = _selectedToOrder.containsKey(name);
                          final int currentQty = isInOrder ? _selectedToOrder[name]!['quantity'] : 0;

                          if (isInOrder) {
                            return Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                GestureDetector(
                                  onTap: () => _updateOrderQuantity(name, currentQty - 1),
                                  child: Container(
                                    padding: EdgeInsets.all(6.r),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.black.withOpacity(0.05)),
                                    ),
                                    child: Icon(LucideIcons.minus, size: 12.sp, color: Colors.black),
                                  ),
                                ),
                                SizedBox(width: 8.w),
                                Text(
                                  '$currentQty',
                                  style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.black),
                                ),
                                SizedBox(width: 8.w),
                                GestureDetector(
                                  onTap: () => _updateOrderQuantity(name, currentQty + 1),
                                  child: Container(
                                    padding: EdgeInsets.all(6.r),
                                    decoration: const BoxDecoration(
                                      color: Colors.black,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(LucideIcons.plus, size: 12.sp, color: Colors.white),
                                  ),
                                ),
                              ],
                            );
                          } else {
                            return GestureDetector(
                              onTap: () => _addToOrder(alert, needed),
                              child: Container(
                                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
                                decoration: BoxDecoration(
                                  color: Colors.black,
                                  borderRadius: BorderRadius.circular(10.r),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(LucideIcons.plus, color: Colors.white, size: 10.sp),
                                    SizedBox(width: 4.w),
                                    Text(
                                      'PEDIR: $needed',
                                      style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: Colors.white),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }
                        })(),
                      ],
                    ),
                    Divider(color: Colors.grey.shade100, height: 24.h),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildStockInfoCol('STOCK ACTUAL', '$stock uds', isCritical: stock <= minStock),
                        _buildStockInfoCol('STOCK MÍNIMO', '$minStock uds', isCritical: false),
                        _buildStockInfoCol('VENTAS 7 DÍAS', '$weeklySales uds', isCritical: false),
                      ],
                    ),
                  ],
                ),
              );
            }),

          SizedBox(height: 32.h),

          // Section 2: Full Inventory List
          Text(
            'INVENTARIO GENERAL DE PRODUCTOS',
            style: TextStyle(
              fontSize: 10.sp,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade400,
              letterSpacing: 1.5.w,
            ),
          ),
          SizedBox(height: 16.h),

          // Search Field
          Container(
            padding: EdgeInsets.symmetric(horizontal: 16.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(color: Colors.black.withOpacity(0.05)),
            ),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Buscar por nombre o categoría...',
                hintStyle: TextStyle(fontSize: 12.sp, color: Colors.grey.shade400),
                prefixIcon: const Icon(LucideIcons.search, size: 18),
                border: InputBorder.none,
              ),
            ),
          ),
          SizedBox(height: 16.h),

          if (_filteredProducts.isEmpty)
            Center(
              child: Padding(
                padding: EdgeInsets.all(32.w),
                child: Text(
                  'No se encontraron productos.',
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 13.sp),
                ),
              ),
            )
          else
            ..._filteredProducts.map((p) {
              final String name = p['name'] ?? 'Producto';
              final String category = p['category'] ?? 'General';
              final int stock = p['stock'] ?? 0;
              final int minStock = p['minimumStock'] ?? 0;
              final double price = (p['finalPrice'] ?? 0.0).toDouble();
              final bool isLowStock = stock <= minStock;

              return Container(
                margin: EdgeInsets.only(bottom: 12.h),
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20.r),
                  border: Border.all(color: Colors.black.withOpacity(0.04)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: Colors.black),
                          ),
                          SizedBox(height: 2.h),
                          Row(
                            children: [
                              Container(
                                padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(4.r),
                                ),
                                child: Text(
                                  category.toUpperCase(),
                                  style: TextStyle(fontSize: 8.sp, color: Colors.grey.shade500, fontWeight: FontWeight.bold),
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Text(
                                '\$${NumberFormat('#,##0', 'es_AR').format(price)}',
                                style: TextStyle(fontSize: 10.sp, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                          decoration: BoxDecoration(
                            color: isLowStock ? Colors.red.shade50 : Colors.green.shade50,
                            borderRadius: BorderRadius.circular(8.r),
                          ),
                          child: Text(
                            'STOCK: $stock',
                            style: TextStyle(
                              fontSize: 10.sp,
                              fontWeight: FontWeight.w900,
                              color: isLowStock ? Colors.red.shade700 : Colors.green.shade700,
                            ),
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          'Mínimo: $minStock',
                          style: TextStyle(fontSize: 8.sp, color: Colors.grey.shade400, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    SizedBox(width: 12.w),
                    (() {
                      final bool isInOrder = _selectedToOrder.containsKey(name);
                      final int currentQty = isInOrder ? _selectedToOrder[name]!['quantity'] : 0;

                      if (isInOrder) {
                        return Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            GestureDetector(
                              onTap: () => _updateOrderQuantity(name, currentQty - 1),
                              child: Container(
                                padding: EdgeInsets.all(4.r),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.black.withOpacity(0.05)),
                                ),
                                child: Icon(LucideIcons.minus, size: 10.sp, color: Colors.black),
                              ),
                            ),
                            SizedBox(width: 6.w),
                            Text(
                              '$currentQty',
                              style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: Colors.black),
                            ),
                            SizedBox(width: 6.w),
                            GestureDetector(
                              onTap: () => _updateOrderQuantity(name, currentQty + 1),
                              child: Container(
                                padding: EdgeInsets.all(4.r),
                                decoration: const BoxDecoration(
                                  color: Colors.black,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(LucideIcons.plus, size: 10.sp, color: Colors.white),
                              ),
                            ),
                          ],
                        );
                      } else {
                        return GestureDetector(
                          onTap: () {
                            final diff = minStock - stock;
                            final defaultQty = diff > 0 ? diff : 1;
                            _addToOrder(p, defaultQty);
                          },
                          child: Container(
                            padding: EdgeInsets.all(8.r),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.black.withOpacity(0.05)),
                            ),
                            child: Icon(LucideIcons.shoppingCart, size: 14.sp, color: Colors.grey.shade600),
                          ),
                        );
                      }
                    })(),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildStockInfoCol(String label, String value, {required bool isCritical}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 8.sp, color: Colors.grey.shade400, fontWeight: FontWeight.bold),
        ),
        SizedBox(height: 4.h),
        Text(
          value,
          style: TextStyle(
            fontSize: 12.sp,
            fontWeight: FontWeight.w900,
            color: isCritical ? Colors.red.shade700 : Colors.black,
          ),
        ),
      ],
    );
  }

  Color _parseHexColor(String hexString) {
    try {
      final hexCode = hexString.replaceAll('#', '');
      return Color(int.parse('FF$hexCode', radix: 16));
    } catch (e) {
      return Colors.grey.shade600;
    }
  }
}
