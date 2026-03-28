import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/services/membership_service.dart';

final membershipServiceProvider = Provider((ref) => MembershipService());

class MembershipQrState {
  final bool isLoading;
  final String? qrToken;
  final String? error;

  MembershipQrState({this.isLoading = false, this.qrToken, this.error});

  MembershipQrState copyWith({bool? isLoading, String? qrToken, String? error}) {
    return MembershipQrState(
      isLoading: isLoading ?? this.isLoading,
      qrToken: qrToken ?? this.qrToken,
      error: error ?? this.error,
    );
  }
}

final membershipQrProvider = StateNotifierProvider<MembershipQrNotifier, MembershipQrState>((ref) {
  return MembershipQrNotifier(ref.watch(membershipServiceProvider));
});

class MembershipQrNotifier extends StateNotifier<MembershipQrState> {
  final MembershipService _membershipService;
  Timer? _refreshTimer;

  MembershipQrNotifier(this._membershipService) : super(MembershipQrState());

  Future<void> fetchQrToken() async {
    state = state.copyWith(isLoading: true, error: null);
    final token = await _membershipService.generateQrToken();
    if (token != null) {
      state = state.copyWith(isLoading: false, qrToken: token);
      _startRefreshTimer();
    } else {
      state = state.copyWith(isLoading: false, error: 'Error al generar código QR');
    }
  }

  void _startRefreshTimer() {
    _refreshTimer?.cancel();
    // Refresh every 4 minutes (token expires in 5)
    _refreshTimer = Timer.periodic(const Duration(minutes: 4), (timer) {
      fetchQrToken();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}
