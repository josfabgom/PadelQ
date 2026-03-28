import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class MembershipService {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:5041/api'));
  final _storage = const FlutterSecureStorage();

  Future<String?> getToken() async {
    return await _storage.read(key: 'jwt_token');
  }

  Future<String?> generateQrToken() async {
    try {
      final token = await getToken();
      final response = await _dio.get('/membership/generate-qr', options: Options(
        headers: { 'Authorization': 'Bearer $token' }
      ));
      if (response.statusCode == 200) {
        return response.data['token'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
