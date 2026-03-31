import 'package:dio/dio.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';

class ActivityService {
  final Dio _dio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));
  final AuthService _authService = AuthService();

  Future<Options> _getOptions() async {
    final token = await _authService.getToken();
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  Future<List<dynamic>> getActivities() async {
    try {
      final response = await _dio.get('/activities', options: await _getOptions());
      return response.data;
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> signup(int activityId) async {
    try {
      final response = await _dio.post(
        '/activities/$activityId/signup',
        options: await _getOptions(),
      );
      return {'success': true, 'message': response.data['message'] ?? 'Inscripción exitosa'};
    } on DioException catch (e) {
      final message = e.response?.data is Map 
          ? e.response?.data['message'] 
          : (e.response?.data ?? 'Error al inscribirse');
      return {'success': false, 'message': message};
    } catch (e) {
      return {'success': false, 'message': 'Ocurrió un error inesperado'};
    }
  }
}
