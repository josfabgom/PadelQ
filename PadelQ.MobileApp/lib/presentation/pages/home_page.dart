import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _currentIndex = 0;

  void _onItemTapped(int index) {
    setState(() => _currentIndex = index);
    if (index == 1) context.push('/booking');
    if (index == 2) context.push('/activities');
    if (index == 3) context.push('/users');
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('PadelQ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22.sp, color: Colors.blue.shade700)),
        centerTitle: false,
        elevation: 0,
        backgroundColor: Colors.white,
        actions: [
          if (authState.isAdmin)
            IconButton(icon: const Icon(LucideIcons.settings), onPressed: () => context.push('/admin-settings')),
          IconButton(icon: const Icon(LucideIcons.logOut), onPressed: () async {
            await ref.read(authProvider.notifier).logout();
            if (mounted) context.go('/login');
          }),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.all(20.w),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '¡Hola ${authState.user?['fullName'] ?? authState.user?['FullName'] ?? 'Jugador'}!',
                  style: TextStyle(fontSize: 26.sp, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 4.h),
                Text(
                  '¿Qué cancha vas a reservar hoy?',
                  style: TextStyle(fontSize: 14.sp, color: Colors.grey.shade500),
                ),
                SizedBox(height: 16.h),
                
                // Balance and Membership Card
                GestureDetector(
                  onTap: () => context.push('/membership'),
                  child: Container(
                    padding: EdgeInsets.all(20.w),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [Colors.blue.shade800, Colors.blue.shade600]),
                      borderRadius: BorderRadius.circular(20.r),
                      boxShadow: [BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4))],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('MI SALDO', style: TextStyle(color: Colors.white70, fontSize: 10.sp, fontWeight: FontWeight.bold, letterSpacing: 1)),
                            SizedBox(height: 4.h),
                            Text(
                              '\$${(authState.user?['balance'] ?? 0.0).toString()}',
                              style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('MEMBRESÍA', style: TextStyle(color: Colors.white70, fontSize: 10.sp, fontWeight: FontWeight.bold, letterSpacing: 1)),
                            SizedBox(height: 4.h),
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(8.r)),
                              child: Text(
                                authState.user?['membershipName'] ?? 'Sin Plan',
                                style: TextStyle(color: Colors.white, fontSize: 12.sp, fontWeight: FontWeight.bold),
                              ),
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
          
          Expanded(
            child: ListView(
              padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 20.h),
              children: [
                _BookingCard(
                  name: "Cancha 1", 
                  type: "Vidrio - Interior", 
                  imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=2070&auto=format&fit=crop",
                  price: "30€/hr",
                ),
                SizedBox(height: 16.h),
                _BookingCard(
                  name: "Cancha 2", 
                  type: "Muro - Exterior", 
                  imageUrl: "https://images.unsplash.com/photo-1592910129881-892b7b392e81?q=80&w=2070&auto=format&fit=crop",
                  price: "25€/hr",
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onItemTapped,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.blue.shade700,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(icon: Icon(LucideIcons.home), label: 'Inicio'),
          BottomNavigationBarItem(icon: Icon(LucideIcons.calendar), label: 'Alquiler'),
          BottomNavigationBarItem(icon: Icon(LucideIcons.activity), label: 'Actividades'),
          BottomNavigationBarItem(icon: Icon(LucideIcons.users), label: 'Usuarios'),
        ],
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
        borderRadius: BorderRadius.circular(24.r),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.vertical(top: Radius.circular(24.r)),
            child: Image.network(imageUrl, height: 180.h, width: double.infinity, fit: BoxFit.cover),
          ),
          Padding(
            padding: EdgeInsets.all(16.w),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold)),
                    SizedBox(height: 4.h),
                    Text(type, style: TextStyle(color: Colors.grey.shade500, fontSize: 13.sp)),
                  ],
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                  decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(12.r)),
                  child: Text(price, style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
