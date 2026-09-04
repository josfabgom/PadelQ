import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';

class ReportsService {
  final AuthService _authService = AuthService();

  Future<List<Map<String, dynamic>>?> getKitchenSales(DateTime startDate, DateTime endDate) async {
    try {
      final token = await _authService.getToken();
      if (token == null) return null;

      final startStr = DateFormat('yyyy-MM-dd').format(startDate);
      final endStr = DateFormat('yyyy-MM-dd').format(endDate);

      final url = Uri.parse('${ApiConfig.baseUrl}/api/reports/kitchen-sales?startDate=$startStr&endDate=$endStr');

      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.cast<Map<String, dynamic>>();
      }
      
      print('Error fetching kitchen sales: ${response.statusCode}');
      return null;
    } catch (e) {
      print('Exception fetching kitchen sales: $e');
      return null;
    }
  }
}
