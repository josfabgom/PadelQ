import 'package:dio/dio.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';

class ChatMessage {
  final String role; // 'user' or 'model'
  final String text;

  ChatMessage({required this.role, required this.text});

  Map<String, dynamic> toJson() => {
    'role': role,
    'text': text,
  };
}

class ChatbotResponse {
  final String reply;
  final String action;
  final bool success;

  ChatbotResponse({
    required this.reply,
    required this.action,
    required this.success,
  });

  factory ChatbotResponse.fromJson(Map<String, dynamic> json) {
    return ChatbotResponse(
      reply: json['reply'] ?? '',
      action: json['action'] ?? 'none',
      success: json['success'] ?? true,
    );
  }
}

class ChatbotService {
  final Dio _dio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));
  final AuthService _authService = AuthService();

  Future<Options> _getOptions() async {
    final token = await _authService.getToken();
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  Future<ChatbotResponse> sendChatMessage(String message, List<ChatMessage> history) async {
    try {
      final response = await _dio.post(
        '/api/chatbot/chat',
        data: {
          'message': message,
          'history': history.map((e) => e.toJson()).toList(),
        },
        options: await _getOptions(),
      );

      if (response.statusCode == 200) {
        return ChatbotResponse.fromJson(response.data);
      } else {
        return ChatbotResponse(
          reply: '⚠️ Error: No se pudo obtener respuesta del servidor.',
          action: 'none',
          success: false,
        );
      }
    } on DioException catch (e) {
      final errorMsg = e.response?.data?.toString() ?? e.message ?? 'Error desconocido';
      return ChatbotResponse(
        reply: '⚠️ Error de conexión: $errorMsg',
        action: 'none',
        success: false,
      );
    } catch (e) {
      return ChatbotResponse(
        reply: '⚠️ Error inesperado: $e',
        action: 'none',
        success: false,
      );
    }
  }
}
