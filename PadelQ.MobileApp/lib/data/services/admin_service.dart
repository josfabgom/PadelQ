import 'package:dio/dio.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';

class AdminService {
  final Dio _dio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));
  final AuthService _authService = AuthService();

  Future<Options> _getOptions() async {
    final token = await _authService.getToken();
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  Future<Map<String, dynamic>?> getReportsSummary() async {
    try {
      final response = await _dio.get('/api/reports/summary', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print("Error fetching reports summary: $e");
      return null;
    }
  }

  Future<Map<String, dynamic>?> getCashStatus() async {
    try {
      final response = await _dio.get('/api/cash-closures/current-status', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print("Error fetching cash status: $e");
      return null;
    }
  }

  Future<List<dynamic>> getCashHistory() async {
    try {
      final response = await _dio.get('/api/cash-closures/history', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } catch (e) {
      print("Error fetching cash history: $e");
      return [];
    }
  }

  Future<List<dynamic>> getActiveCashSessions() async {
    try {
      final response = await _dio.get('/api/cash-closures/active-sessions', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } catch (e) {
      print("Error fetching active cash sessions: $e");
      return [];
    }
  }

  Future<List<dynamic>> getStockAlerts() async {
    try {
      final response = await _dio.get('/api/reports/stock-alerts', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } catch (e) {
      print("Error fetching stock alerts: $e");
      return [];
    }
  }

  Future<List<dynamic>> getProducts() async {
    try {
      final response = await _dio.get('/api/products', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } catch (e) {
      print("Error fetching products: $e");
      return [];
    }
  }

  Future<List<dynamic>> getBookingsByDate(DateTime date) async {
    try {
      final formattedDate = "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
      final response = await _dio.get('/api/bookings/by-date?date=$formattedDate', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } catch (e) {
      print("Error fetching bookings by date: $e");
      return [];
    }
  }

  Future<List<dynamic>> getSpaceBookingsByDate(DateTime date) async {
    try {
      final formattedDate = "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
      final response = await _dio.get('/api/spacebookings/by-date?date=$formattedDate', options: await _getOptions());
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } catch (e) {
      print("Error fetching space bookings by date: $e");
      return [];
    }
  }
}
