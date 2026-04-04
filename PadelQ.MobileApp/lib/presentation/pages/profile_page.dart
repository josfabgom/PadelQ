import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../config/api_config.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;

  Future<void> _handleChangePassword() async {
    final password = _passwordController.text;
    final confirm = _confirmPasswordController.text;

    if (password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('La contraseña no puede estar vacía')));
      return;
    }

    if (password != confirm) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Las contraseñas no coinciden')));
      return;
    }

    setState(() => _isLoading = true);
    
    final authState = ref.read(authProvider);
    final userId = authState.user?['sub'] ?? authState.user?['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];

    final success = await ref.read(authServiceProvider).changePassword(userId.toString(), password);

    setState(() => _isLoading = false);

    if (success) {
      _passwordController.clear();
      _confirmPasswordController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          backgroundColor: Colors.emerald,
          content: Text('Contraseña actualizada correctamente', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ));
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          backgroundColor: Colors.red,
          content: Text('Error al actualizar la contraseña', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final name = (authState.user?['fullName'] ?? authState.user?['FullName'] ?? 'Usuario').toString();
    final email = (authState.user?['email'] ?? authState.user?['Email'] ?? '').toString();

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: Text('MI PERFIL', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, letterSpacing: 2.w, color: Colors.black)),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(icon: const Icon(LucideIcons.chevronLeft, color: Colors.black), onPressed: () => context.pop()),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(24.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Column(
                children: [
                  Container(
                    width: 100.w,
                    height: 100.w,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, 10))]
                    ),
                    child: Center(
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : 'U',
                        style: TextStyle(color: Colors.white, fontSize: 40.sp, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic),
                      ),
                    ),
                  ),
                  SizedBox(height: 24.h),
                  Text(name.toUpperCase(), style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic, color: Colors.black)),
                  Text(email, style: TextStyle(fontSize: 11.sp, color: Colors.grey.shade500, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            SizedBox(height: 48.h),
            
            Text(
              'ADMINISTRACIÓN DE CUENTA',
              style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.indigo.shade600, letterSpacing: 2.w),
            ),
            SizedBox(height: 24.h),
            
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
                  Text('CAMBIAR CONTRASEÑA', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.black45, letterSpacing: 1.w)),
                  SizedBox(height: 16.h),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: InputDecoration(
                      hintText: 'Nueva Contraseña',
                      hintStyle: TextStyle(fontSize: 12.sp, color: Colors.grey.shade400),
                      prefixIcon: const Icon(LucideIcons.key, size: 18),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide(color: Colors.grey.shade200)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide(color: Colors.grey.shade100)),
                    ),
                  ),
                  SizedBox(height: 16.h),
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: true,
                    decoration: InputDecoration(
                      hintText: 'Confirmar Contraseña',
                      hintStyle: TextStyle(fontSize: 12.sp, color: Colors.grey.shade400),
                      prefixIcon: const Icon(LucideIcons.checkCircle, size: 18),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide(color: Colors.grey.shade200)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide(color: Colors.grey.shade100)),
                    ),
                  ),
                  SizedBox(height: 24.h),
                  SizedBox(
                    width: double.infinity,
                    height: 56.h,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleChangePassword,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                        elevation: 0,
                      ),
                      child: _isLoading 
                        ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                        : const Text('ACTUALIZAR CONTRASEÑA', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.w)),
                    ),
                  ),
                ],
              ),
            ),
            
            SizedBox(height: 48.h),
            Center(
              child: Text(
                ApiConfig.appVersion,
                style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade300, letterSpacing: 2.w),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
