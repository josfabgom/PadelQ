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
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: Image.asset('assets/images/logo-full-black.png', height: 28.h),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.white,
        actions: [
          if (authState.isAdmin)
            IconButton(icon: const Icon(LucideIcons.settings, color: Colors.black, size: 20), onPressed: () => context.push('/admin-settings')),
          IconButton(icon: const Icon(LucideIcons.logOut, color: Colors.black, size: 20), onPressed: () async {
            await ref.read(authProvider.notifier).logout();
            if (mounted) context.go('/login');
          }),
        ],
      ),
      body: Column(
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
                  'RESERVA TU EXPERIENCIA PREMIUM HOY',
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
                            child: Icon(LucideIcons.award, color: Colors.white.withOpacity(0.05), size: 100),
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
          
          Padding(
            padding: EdgeInsets.fromLTRB(24.w, 32.h, 24.w, 0),
            child: Text(
                'CANCHAS DISPONIBLES',
                style: TextStyle(fontSize: 11.sp, fontStyle: FontStyle.italic, fontWeight: FontWeight.w900, letterSpacing: 2.w, color: Colors.black54),
            ),
          ),

          Expanded(
            child: ListView(
              padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
              children: [
                _BookingCard(
                  name: "CANCHA 01", 
                  type: "CRISTAL PANORÁMICO", 
                  imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=2070&auto=format&fit=crop",
                  price: "\$3.500",
                ),
                SizedBox(height: 24.h),
                _BookingCard(
                  name: "CANCHA 02", 
                  type: "MURO PROFESIONAL", 
                  imageUrl: "https://images.unsplash.com/photo-1592910129881-892b7b392e81?q=80&w=2070&auto=format&fit=crop",
                  price: "\$3.000",
                ),
              ],
            ),
          ),
        ],
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
            BottomNavigationBarItem(icon: Icon(LucideIcons.home, size: 20), label: 'HOME'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.calendar, size: 20), label: 'RESERVA'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.activity, size: 20), label: 'PLAY'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.users, size: 20), label: 'SOCIAL'),
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
