import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  Future<void> _handleLogin() async {
    final email = _emailController.text;
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) return;

    await ref.read(authProvider.notifier).login(email, password);

    final authState = ref.read(authProvider);
    if (authState.isAuthenticated) {
      if (mounted) context.go('/home');
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFFE11D48),
            content: Text('Error al iniciar sesión', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Background accents
          Positioned(
            top: -100, right: -100,
            child: Container(
              width: 300, height: 300,
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), shape: BoxShape.circle),
            ),
          ),
          
          SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 32.w),
              child: Column(
                children: [
                  SizedBox(height: 140.h),
                  
                  Image.asset(
                    'assets/images/logo-full-white.png', 
                    height: 120.h,
                  ),
                  
                  SizedBox(height: 12.h),
                  Text(
                    'SISTEMA DE GESTIÓN PREMIUM',
                    style: TextStyle(
                      fontSize: 10.sp, 
                      fontWeight: FontWeight.w900, 
                      color: Colors.grey.withOpacity(0.6),
                      letterSpacing: 4.w,
                    ),
                  ),
                  
                  SizedBox(height: 80.h),
                  
                  _AuthInputField(
                    controller: _emailController, 
                    label: 'USUARIO', 
                    hint: 'tu@email.com',
                  ),
                  SizedBox(height: 24.h),
                  _AuthInputField(
                    controller: _passwordController, 
                    label: 'CONTRASEÑA', 
                    hint: '••••••••',
                    isPassword: true,
                  ),
                  
                  SizedBox(height: 48.h),
                  
                  SizedBox(
                    width: double.infinity,
                    height: 64.h,
                    child: ElevatedButton(
                      onPressed: authState.isLoading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
                        elevation: 0,
                      ),
                      child: authState.isLoading 
                        ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 3))
                        : Text(
                            'INICIAR SESIÓN', 
                            style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, letterSpacing: 2.w),
                          ),
                    ),
                  ),
                  
                  SizedBox(height: 40.h),
                  TextButton(
                    onPressed: () => context.go('/register'),
                    child: Text(
                      '¿NO TIENES CUENTA? REGÍSTRATE AQUÍ',
                      style: TextStyle(
                        fontSize: 10.sp, 
                        color: Colors.white.withOpacity(0.4),
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.w,
                      ),
                    ),
                  ),
                  
                  SizedBox(height: 40.h),
                  Text(
                    'COPYRIGHT © 2026 BLACK MARCA GRÁFICA',
                    style: TextStyle(
                      fontSize: 8.sp, 
                      color: Colors.white.withOpacity(0.2),
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2.w,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthInputField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final bool isPassword;

  const _AuthInputField({
    required this.controller,
    required this.label,
    required this.hint,
    this.isPassword = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(left: 4.w, bottom: 8.h),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10.sp, 
              fontWeight: FontWeight.w900, 
              color: Colors.white.withOpacity(0.8),
              letterSpacing: 2.w,
            ),
          ),
        ),
        TextField(
          controller: controller,
          obscureText: isPassword,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          cursorColor: Colors.white,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.2), fontSize: 13.sp),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20.r), 
              borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20.r), 
              borderSide: BorderSide(color: Colors.white.withOpacity(0.05)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20.r), 
              borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
            ),
            filled: true,
            fillColor: Colors.white.withOpacity(0.05),
            contentPadding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 20.h),
          ),
        ),
      ],
    );
  }
}
