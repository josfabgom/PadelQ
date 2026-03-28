import 'package:dio/dio.dart';
import 'auth_service.dart';

class SettingsService {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:5041/api'));
  final AuthService _authService = AuthService();

  Future<Options> _getOptions() async {
    final token = await _authService.getToken();
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  Future<List<dynamic>> getSettings() async {
    try {
      final response = await _dio.get('/systemsettings', options: await _getOptions());
      return response.data;
    } catch (e) {
      return [];
    }
  }

  Future<bool> updateSetting(String key, String value) async {
    try {
      final response = await _dio.put('/systemsettings', 
        data: {'key': key, 'value': value},
        options: await _getOptions()
      );
      return response.statusCode == 204;
    } catch (e) {
      return false;
    }
  }
}
