import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../data/services/chatbot_service.dart';
import '../providers/auth_provider.dart';

class ChatbotPage extends ConsumerStatefulWidget {
  const ChatbotPage({super.key});

  @override
  ConsumerState<ChatbotPage> createState() => _ChatbotPageState();
}

class _ChatbotPageState extends ConsumerState<ChatbotPage> {
  final ChatbotService _service = ChatbotService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _addInitialGreeting();
  }

  void _addInitialGreeting() {
    // Retrasar levemente para poder obtener el perfil del usuario si es necesario
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authState = ref.read(authProvider);
      final userName = (authState.user?['fullName'] ?? authState.user?['FullName'] ?? 'Jugador').toString().split(' ').first;

      setState(() {
        _messages.add(ChatMessage(
          role: 'model',
          text: '¡Hola, $userName! 🎾 Soy tu **Asistente Virtual de Black Club**.\n\nPuedo ayudarte a encontrar horarios libres y reservar canchas al instante usando lenguaje natural.\n\nPrueba preguntándome:\n- *¿Qué canchas están libres hoy por la tarde?*\n- *¿Hay disponibilidad para mañana a las 18:00?*\n- *Reserva la Cancha Cristal mañana a las 19 hs por 90 min*',
        ));
      });
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    final userMessage = ChatMessage(role: 'user', text: text);
    setState(() {
      _messages.add(userMessage);
      _isLoading = true;
    });

    _messageController.clear();
    _scrollToBottom();

    // Obtener respuesta del backend
    final response = await _service.sendChatMessage(text, _messages.sublist(0, _messages.length - 1));

    if (mounted) {
      setState(() {
        _messages.add(ChatMessage(role: 'model', text: response.reply));
        _isLoading = false;
      });
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: EdgeInsets.all(6.w),
              decoration: const BoxDecoration(
                color: Colors.black,
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 14),
            ),
            SizedBox(width: 8.w),
            Text(
              'ASISTENTE AI',
              style: TextStyle(
                fontSize: 12.sp,
                fontWeight: FontWeight.w900,
                letterSpacing: 2.w,
                color: Colors.black,
              ),
            ),
          ],
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft, color: Colors.black),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.trash2, size: 18, color: Colors.grey),
            onPressed: () {
              setState(() {
                _messages.clear();
                _addInitialGreeting();
              });
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: EdgeInsets.all(24.w),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return _buildMessageBubble(msg);
              },
            ),
          ),
          if (_isLoading) _buildTypingIndicator(),
          _buildQuickSuggestions(),
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg) {
    final isUser = msg.role == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(bottom: 16.h),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
        decoration: BoxDecoration(
          color: isUser ? Colors.black : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24.r),
            topRight: Radius.circular(24.r),
            bottomLeft: isUser ? Radius.circular(24.r) : Radius.zero,
            bottomRight: isUser ? Radius.zero : Radius.circular(24.r),
          ),
          border: isUser ? null : Border.all(color: Colors.black.withOpacity(0.04)),
          boxShadow: isUser 
              ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))]
              : [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 5))],
        ),
        child: _buildRichText(msg.text, isUser),
      ),
    );
  }

  // Helper para renderizar formato enriquecido rudimentario (negrita y viñetas) en las respuestas de la IA
  Widget _buildRichText(String text, bool isUser) {
    final textColor = isUser ? Colors.white : Colors.black;
    final textStyle = TextStyle(
      color: textColor,
      fontSize: 13.sp,
      fontWeight: FontWeight.w500,
      height: 1.4,
    );

    // Dividimos por saltos de línea
    final List<String> lines = text.split('\n');
    final List<Widget> children = [];

    for (var line in lines) {
      if (line.trim().startsWith('-')) {
        // Formatear viñeta
        final cleanText = line.trim().substring(1).trim();
        children.add(
          Padding(
            padding: EdgeInsets.only(left: 8.w, bottom: 4.h),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('• ', style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
                Expanded(child: _buildInlineFormatting(cleanText, textColor)),
              ],
            ),
          ),
        );
      } else {
        // Párrafo común
        children.add(
          Padding(
            padding: EdgeInsets.only(bottom: 6.h),
            child: _buildInlineFormatting(line, textColor),
          ),
        );
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: children,
    );
  }

  // Parsea negritas rudimentarias marcadas con ** o *
  Widget _buildInlineFormatting(String text, Color textColor) {
    final List<TextSpan> spans = [];
    final RegExp regex = RegExp(r'\*\*([^*]+)\*\*|\*([^*]+)\*');
    int start = 0;

    for (var match in regex.allMatches(text)) {
      // Texto antes de la coincidencia
      if (match.start > start) {
        spans.add(TextSpan(text: text.substring(start, match.start)));
      }

      // Detectar si es negrita (** o *)
      final boldText = match.group(1) ?? match.group(2);
      if (boldText != null) {
        spans.add(TextSpan(
          text: boldText,
          style: const TextStyle(fontWeight: FontWeight.bold, fontStyle: FontStyle.italic),
        ));
      }

      start = match.end;
    }

    if (start < text.length) {
      spans.add(TextSpan(text: text.substring(start)));
    }

    return RichText(
      text: TextSpan(
        style: TextStyle(
          color: textColor,
          fontSize: 13.sp,
          fontWeight: FontWeight.w500,
          fontFamily: 'OakSans',
          height: 1.4,
        ),
        children: spans,
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(left: 24.w, bottom: 16.h),
        padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 12.h),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20.r),
          border: Border.all(color: Colors.black.withOpacity(0.04)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.sparkles, size: 14, color: Colors.grey),
            SizedBox(width: 10.w),
            Text(
              'Pensando...',
              style: TextStyle(fontSize: 11.sp, color: Colors.grey, fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickSuggestions() {
    final suggestions = [
      '¿Qué turnos hay hoy?',
      '¿Qué hay libre mañana?',
      'Ver canchas activas',
    ];

    return Container(
      height: 45.h,
      margin: EdgeInsets.only(bottom: 8.h),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(horizontal: 20.w),
        itemCount: suggestions.length,
        itemBuilder: (context, index) {
          final text = suggestions[index];
          return GestureDetector(
            onTap: () => _sendMessage(text),
            child: Container(
              margin: EdgeInsets.only(right: 8.w),
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16.r),
                border: Border.all(color: Colors.black.withOpacity(0.05)),
              ),
              child: Center(
                child: Text(
                  text,
                  style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.bold, color: Colors.black),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(20.w, 12.h, 20.w, 32.h),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(24.r),
              ),
              padding: EdgeInsets.symmetric(horizontal: 20.w),
              child: TextField(
                controller: _messageController,
                style: TextStyle(fontSize: 13.sp),
                decoration: InputDecoration(
                  hintText: 'Pregunta algo sobre los turnos...',
                  hintStyle: TextStyle(color: Colors.grey, fontSize: 13.sp),
                  border: InputBorder.none,
                ),
                onSubmitted: _sendMessage,
              ),
            ),
          ),
          SizedBox(width: 12.w),
          GestureDetector(
            onTap: () => _sendMessage(_messageController.text),
            child: Container(
              padding: EdgeInsets.all(16.w),
              decoration: const BoxDecoration(
                color: Colors.black,
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.send, color: Colors.white, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}
