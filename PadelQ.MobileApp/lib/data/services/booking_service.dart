import 'package:dio/dio.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';

class BookingService {
  final Dio _dio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));
  final AuthService _authService = AuthService();

  Future<Options> _getOptions() async {
    final token = await _authService.getToken();
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  Future<List<dynamic>> getCourts() async {
    try {
      final response = await _dio.get('/courts', options: await _getOptions());
      return response.data;
    } catch (e) {
      return [];
    }
  }

  Future<List<dynamic>> getMyBookings() async {
    try {
      final response = await _dio.get('/bookings/my-bookings', options: await _getOptions());
      return response.data;
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> createBooking(int courtId, DateTime startTime, int duration) async {
    try {
      final response = await _dio.post('/bookings/create', 
        data: {
          'courtId': courtId,
          'startTime': startTime.toIso8601String(),
          'durationMinutes': duration,
        },
        options: await _getOptions()
      );
      return {'success': true, 'message': response.data['message']};
    } on DioException catch (e) {
      return {'success': false, 'message': e.response?.data ?? 'Error al reservar'};
    }
  }

  Future<bool> cancelBooking(String bookingId) async {
    try {
      final response = await _dio.delete('/bookings/$bookingId', options: await _getOptions());
      return response.statusCode == 204;
    } catch (e) {
      return false;
    }
  }
}
