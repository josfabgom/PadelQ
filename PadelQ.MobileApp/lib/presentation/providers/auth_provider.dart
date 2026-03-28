import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../../data/services/auth_service.dart';

final authServiceProvider = Provider((ref) => AuthService());

class AuthState {
  final bool isLoading;
  final String? error;
  final Map<String, dynamic>? user;
  final bool isAuthenticated;

  AuthState({this.isLoading = false, this.error, this.user, this.isAuthenticated = false});

  bool get isAdmin {
    if (user == null) return false;
    final role = user!['role'] ?? user!['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    if (role is List) return role.contains('Admin');
    return role == 'Admin';
  }

  AuthState copyWith({bool? isLoading, String? error, Map<String, dynamic>? user, bool? isAuthenticated}) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      user: user ?? this.user,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authServiceProvider));
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(AuthState());

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    final success = await _authService.login(email, password);
    if (success) {
      final token = await _authService.getToken();
      if (token != null) {
        final userData = JwtDecoder.decode(token);
        final userId = userData['sub'] ?? userData['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        
        // Fetch detailed info (balance, membership)
        final detailedInfo = await _authService.getUserInfo(userId);
        final finalUser = {...userData, ...?detailedInfo};

        state = state.copyWith(isLoading: false, user: finalUser, isAuthenticated: true);
      }
    } else {
      state = state.copyWith(isLoading: false, error: 'Credenciales inválidas');
    }
  }

  Future<void> register(String fullName, String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    final success = await _authService.register(fullName, email, password);
    if (success) {
      state = state.copyWith(isLoading: false, error: null);
    } else {
      state = state.copyWith(isLoading: false, error: 'Error al registrar');
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    await _authService.logout();
    state = AuthState();
  }
}
