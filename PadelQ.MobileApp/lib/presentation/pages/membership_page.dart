import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/membership_provider.dart';
import '../providers/auth_provider.dart';

class MembershipPage extends ConsumerStatefulWidget {
  const MembershipPage({super.key});

  @override
  ConsumerState<MembershipPage> createState() => _MembershipPageState();
}

class _MembershipPageState extends ConsumerState<MembershipPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(membershipQrProvider.notifier).fetchQrToken());
  }

  @override
  Widget build(BuildContext context) {
    final qrState = ref.watch(membershipQrProvider);
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Mi Membresía', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(24.w),
        child: Column(
          children: [
            // Membership Info Card
            Container(
              padding: EdgeInsets.all(24.w),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [Colors.blue.shade800, Colors.blue.shade600]),
                borderRadius: BorderRadius.circular(24.r),
                boxShadow: [BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 8))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Icon(LucideIcons.award, color: Colors.white, size: 32.sp),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                        decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(12.r)),
                        child: Text(
                          'ACTIVO',
                          style: TextStyle(color: Colors.white, fontSize: 12.sp, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 24.h),
                  Text(
                    authState.user?['fullName'] ?? authState.user?['FullName'] ?? 'Jugador',
                    style: TextStyle(color: Colors.white, fontSize: 20.sp, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8.h),
                  Text(
                    authState.user?['membershipName'] ?? 'Socio PadelQ',
                    style: TextStyle(color: Colors.white70, fontSize: 14.sp),
                  ),
                  Divider(color: Colors.white24, height: 32.h),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _InfoTile(label: 'ID SOCIO', value: '#${authState.user?['sub']?.toString().substring(0, 8) ?? '0001'}'),
                      _InfoTile(label: 'DESCUENTO', value: '${authState.user?['discountPercentage'] ?? '15'}%'),
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(height: 32.h),
            
            // QR Section
            Container(
              padding: EdgeInsets.all(32.w),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24.r),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Column(
                children: [
                  Text(
                    'Código de Validación',
                    style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8.h),
                  Text(
                    'Muestra este código en recepción para aplicar tus beneficios.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13.sp, color: Colors.grey.shade600),
                  ),
                  SizedBox(height: 32.h),
                  if (qrState.isLoading)
                    SizedBox(height: 200.h, child: const Center(child: CircularProgressIndicator()))
                  else if (qrState.error != null)
                    SizedBox(
                      height: 200.h,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.alertCircle, color: Colors.red, size: 48.sp),
                          SizedBox(height: 16.h),
                          Text(qrState.error!, style: const TextStyle(color: Colors.red)),
                          TextButton(
                            onPressed: () => ref.read(membershipQrProvider.notifier).fetchQrToken(),
                            child: const Text('Reintentar'),
                          )
                        ],
                      ),
                    )
                  else if (qrState.qrToken != null)
                    QrImageView(
                      data: qrState.qrToken!,
                      version: QrVersions.auto,
                      size: 200.w,
                      backgroundColor: Colors.white,
                    )
                  else
                     const Text('No se pudo generar el código QR'),
                  
                  SizedBox(height: 24.h),
                  Text(
                    'Se actualiza automáticamente cada 5 minutos',
                    style: TextStyle(fontSize: 11.sp, color: Colors.grey.shade400, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String label;
  final String value;

  const _InfoTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.white70, fontSize: 10.sp, fontWeight: FontWeight.bold, letterSpacing: 1)),
        SizedBox(height: 4.h),
        Text(value, style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
