import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:padelq_mobile/presentation/pages/login_page.dart';
import 'package:padelq_mobile/presentation/pages/home_page.dart';
import 'package:padelq_mobile/presentation/pages/profile_page.dart';
import 'package:padelq_mobile/presentation/pages/register_page.dart';
import 'package:padelq_mobile/presentation/pages/booking_page.dart';
import 'package:padelq_mobile/presentation/pages/admin_settings_page.dart';
import 'package:padelq_mobile/presentation/pages/activities_page.dart';
import 'package:padelq_mobile/presentation/pages/membership_page.dart';


void main() {
  runApp(const ProviderScope(child: MyApp()));
}

final _router = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
    GoRoute(path: '/register', builder: (context, state) => const RegisterPage()),
    GoRoute(path: '/home', builder: (context, state) => const HomePage()),
    GoRoute(path: '/users', builder: (context, state) => const ProfilePage()),
    GoRoute(path: '/booking', builder: (context, state) => const BookingPage()),
    GoRoute(path: '/admin-settings', builder: (context, state) => const AdminSettingsPage()),
    GoRoute(path: '/activities', builder: (context, state) => const ActivitiesPage()),
    GoRoute(path: '/membership', builder: (context, state) => const MembershipPage()),

  ],
);

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenUtilInit(
      designSize: const Size(390, 844),
      minTextAdapt: true,
      splitScreenMode: true,
      builder: (context, child) {
        return MaterialApp.router(
          title: 'Black Club de Padel',
          debugShowCheckedModeBanner: false,
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('es', ''),
            Locale('en', ''),
          ],
          locale: const Locale('es', ''),
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: Colors.black,
              primary: Colors.black,
              secondary: Colors.black87,
              surface: Colors.white,
              background: const Color(0xFFFAFAFA),
            ),
            fontFamily: 'OakSans',
            textTheme: const TextTheme(
              displayLarge: TextStyle(fontWeight: FontWeight.w900, color: Colors.black, fontStyle: FontStyle.italic),
              headlineMedium: TextStyle(fontWeight: FontWeight.w900, color: Colors.black, fontStyle: FontStyle.italic),
              titleLarge: TextStyle(fontWeight: FontWeight.w800, color: Colors.black),
              bodyLarge: TextStyle(fontWeight: FontWeight.w500, color: Colors.black87),
            ),
          ),
          routerConfig: _router,
        );
      },
    );
  }
}
