import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../../config/api_config.dart';
import 'package:padelq_mobile/config/api_config.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(authProvider.notifier).refreshProfile());
  }

  void _onItemTapped(int index) {
    final authState = ref.read(authProvider);
    
    if (index == 1 && !authState.canAccessBookings) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Acceso restringido a Reservas por la administración.')));
      return;
    }
    if (index == 2 && !authState.canAccessActivities) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Acceso restringido a Actividades por la administración.')));
      return;
    }

    setState(() => _currentIndex = index);
    if (index == 1) context.push('/booking');
    if (index == 2) context.push('/activities');
    if (index == 3) context.push('/users'); // Renovables en futura versión a /profile
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: Image.asset('assets/images/logo-full-black.png', height: 28.h),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.white,
        actions: [
          if (authState.isAdmin)
            IconButton(icon: const Icon(Icons.settings, color: Colors.black, size: 20), onPressed: () => context.push('/admin-settings')),
          IconButton(icon: const Icon(Icons.logout, color: Colors.black, size: 20), onPressed: () async {
            await ref.read(authProvider.notifier).logout();
            if (mounted) context.go('/login');
          }),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 32.h),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'HOLA, ',
                        style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.normal, color: Colors.black),
                      ),
                      Text(
                        (authState.user?['fullName'] ?? authState.user?['FullName'] ?? 'JUGADOR').toString().toUpperCase(),
                        style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w900, color: Colors.black, fontStyle: FontStyle.italic),
                      ),
                    ],
                  ),
                  SizedBox(height: 4.h),
                  Text(
                    'GESTIÓN DE TU MEMBRESÍA PREMIUM',
                    style: TextStyle(fontSize: 9.sp, color: Colors.grey.shade400, fontWeight: FontWeight.w900, letterSpacing: 2.w),
                  ),
                  SizedBox(height: 32.h),
                  
                  // Balance and Membership Card
                  GestureDetector(
                    onTap: () => context.push('/membership'),
                    child: Container(
                      padding: EdgeInsets.all(32.w),
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(32.r),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 30, offset: const Offset(0, 15))],
                      ),
                      child: Stack(
                        children: [
                          Positioned(
                              right: -20, bottom: -20,
                              child: Icon(Icons.workspace_premium, color: Colors.white.withOpacity(0.05), size: 100),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('SALDO DISPONIBLE', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w)),
                                  SizedBox(height: 8.h),
                                  Text(
                                    '\$${(authState.user?['balance'] ?? 0.0).toString()}',
                                    style: TextStyle(color: Colors.white, fontSize: 28.sp, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('ESTADO', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w)),
                                  SizedBox(height: 8.h),
                                  Container(
                                    padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
                                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(16.r), border: Border.all(color: Colors.white.withOpacity(0.1))),
                                    child: Text(
                                      (authState.user?['membershipName'] ?? 'SIN PLAN').toString().toUpperCase(),
                                      style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            
            SizedBox(height: 60.h),
            Center(
              child: Column(
                children: [
                  Text(
                    'PadelQ PLATFORM',
                    style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade300, letterSpacing: 4.w),
                  ),
                  SizedBox(height: 8.h),
                  Text(
                    ApiConfig.appVersion,
                    style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade300),
                  ),
                ],
              ),
            ),
            SizedBox(height: 40.h),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20)],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onItemTapped,
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: Colors.black,
          unselectedItemColor: Colors.grey.shade400,
          selectedLabelStyle: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w),
          unselectedLabelStyle: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home, size: 20), label: 'HOME'),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_month, size: 20), label: 'RESERVA'),
            BottomNavigationBarItem(icon: Icon(Icons.bolt, size: 20), label: 'PLAY'),
            BottomNavigationBarItem(icon: Icon(Icons.person, size: 20), label: 'PERFIL'),
          ],
        ),
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final String name;
  final String type;
  final String price;
  final String imageUrl;

  const _BookingCard({
    required this.name, 
    required this.type, 
    required this.price,
    required this.imageUrl
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32.r),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, offset: const Offset(0, 10))],
        border: Border.all(color: Colors.black.withOpacity(0.03)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.vertical(top: Radius.circular(32.r)),
            child: Stack(
              children: [
                Image.network(imageUrl, height: 180.h, width: double.infinity, fit: BoxFit.cover),
                Positioned(
                    top: 20, right: 20,
                    child: Container(
                        padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
                        decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(16.r)),
                        child: Text(price, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10.sp)),
                    ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(24.w),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                        name, 
                        style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic, color: Colors.black)
                    ),
                    SizedBox(height: 4.h),
                    Text(
                        type, 
                        style: TextStyle(color: Colors.grey.shade400, fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1.w)
                    ),
                  ],
                ),
                Icon(LucideIcons.chevronRight, size: 20, color: Colors.black.withOpacity(0.1)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
