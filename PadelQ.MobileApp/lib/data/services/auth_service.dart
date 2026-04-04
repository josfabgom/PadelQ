import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../config/api_config.dart';

class AuthService {
  final Dio _dio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));
  final _storage = const FlutterSecureStorage();

  Future<bool> login(String email, String password) async {
    try {
      final response = await _dio.post('/api/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        final token = response.data['token'];
        await _storage.write(key: 'jwt_token', value: token);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> register(String fullName, String email, String password) async {
    try {
      final response = await _dio.post('/api/auth/register', data: {
        'fullName': fullName,
        'email': email,
        'password': password,
      });
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<String?> getToken() async {
    return await _storage.read(key: 'jwt_token');
  }

  Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
  }

  Future<Map<String, dynamic>?> getUserInfo(String userId) async {
    try {
      final token = await getToken();
      final response = await _dio.get('/api/users/$userId', options: Options(
        headers: { 'Authorization': 'Bearer $token' }
      ));
      if (response.statusCode == 200) {
        return response.data;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
