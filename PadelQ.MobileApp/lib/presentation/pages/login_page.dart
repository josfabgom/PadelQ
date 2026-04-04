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
          SnackBar(
            backgroundColor: const Color(0xFFE11D48),
            content: Text(authState.error ?? 'Error al iniciar sesión', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
          // Decorative background accents
          Positioned(
            top: -100, right: -100,
            child: Container(
              width: 400, height: 400,
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.03), shape: BoxShape.circle),
            ),
          ),
          
          Center(
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400.0),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 40.0, vertical: 60.0),
                    decoration: BoxDecoration(
                      color: const Color(0xFF18181B).withOpacity(0.8),
                      borderRadius: BorderRadius.circular(40.0),
                      border: Border.all(color: Colors.white.withOpacity(0.05)),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 40, offset: const Offset(0, 20))
                      ]
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Image.asset('assets/images/logo-full-white.png', height: 120.0),
                        
                        const SizedBox(height: 16.0),
                        Text(
                          'SISTEMA DE GESTIÓN',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12.0, 
                            fontWeight: FontWeight.w900, 
                            color: Colors.white.withOpacity(0.4),
                            letterSpacing: 4.0,
                          ),
                        ),
                        
                        const SizedBox(height: 50.0),
                        
                        _AuthInputField(
                          controller: _emailController, 
                          label: 'USUARIO', 
                          hint: 'Ingresa tu email',
                        ),
                        const SizedBox(height: 24.0),
                        _AuthInputField(
                          controller: _passwordController, 
                          label: 'CONTRASEÑA', 
                          hint: '••••••••',
                          isPassword: true,
                        ),
                        
                        const SizedBox(height: 50.0),
                        
                        SizedBox(
                          width: double.infinity,
                          height: 60.0,
                          child: ElevatedButton(
                            onPressed: authState.isLoading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.black,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.0)),
                              elevation: 0,
                            ),
                            child: authState.isLoading 
                              ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 3))
                              : const Text('INICIAR SESIÓN', style: TextStyle(fontSize: 14.0, fontWeight: FontWeight.w900, letterSpacing: 2.0)),
                          ),
                        ),
                        
                        const SizedBox(height: 40.0),
                        Text(
                          'COPYRIGHT © 2026 BLACK MARCA GRÁFICA',
                          style: TextStyle(
                            fontSize: 10.0, 
                            color: Colors.white.withOpacity(0.2),
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
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

  const _AuthInputField({required this.controller, required this.label, required this.hint, this.isPassword = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4.0, bottom: 8.0),
          child: Text(
            label,
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.w900, color: Colors.white.withOpacity(0.5), letterSpacing: 2.0),
          ),
        ),
        TextField(
          controller: controller,
          obscureText: isPassword,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          cursorColor: Colors.white,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.1), fontSize: 14.0),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16.0), borderSide: BorderSide.none),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16.0), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16.0), borderSide: BorderSide(color: Colors.white.withOpacity(0.2))),
            filled: true,
            fillColor: const Color(0xFF27272A).withOpacity(0.5),
            contentPadding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 18.0),
          ),
        ),
      ],
    );
  }
}
