import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../data/services/settings_service.dart';

class AdminSettingsPage extends StatefulWidget {
  const AdminSettingsPage({super.key});

  @override
  State<AdminSettingsPage> createState() => _AdminSettingsPageState();
}

class _AdminSettingsPageState extends State<AdminSettingsPage> {
  final SettingsService _service = SettingsService();
  final Map<String, TextEditingController> _controllers = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    setState(() => _isLoading = true);
    final settings = await _service.getSettings();
    for (var s in settings) {
      _controllers[s['key']] = TextEditingController(text: s['value'].toString());
    }
    setState(() => _isLoading = false);
  }

  Future<void> _saveSetting(String key) async {
    final value = _controllers[key]?.text;
    if (value == null) return;
    
    final success = await _service.updateSetting(key, value);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(success ? 'Configuración actualizada' : 'Error al guardar')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(title: const Text('Administración', style: TextStyle(fontWeight: FontWeight.bold))),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: EdgeInsets.all(20.w),
            children: [
              _buildSectionHeader('Precios y Tarifas'),
              _buildSettingField('PricePerHour', 'Precio por Hora (USD)', LucideIcons.dollarSign),
              SizedBox(height: 24.h),
              _buildSectionHeader('Horarios del Club'),
              _buildSettingField('OpenHour', 'Hora de Apertura (0-23)', LucideIcons.sun),
              _buildSettingField('CloseHour', 'Hora de Cierre (0-23)', LucideIcons.moon),
            ],
          ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: Text(title, style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: Colors.blue.shade800)),
    );
  }

  Widget _buildSettingField(String key, String label, IconData icon) {
    return Container(
      margin: EdgeInsets.only(bottom: 16.h),
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r)),
      child: Row(
        children: [
          Icon(icon, color: Colors.blue.shade400),
          SizedBox(width: 16.w),
          Expanded(
            child: TextField(
              controller: _controllers[key],
              decoration: InputDecoration(labelText: label, border: InputBorder.none),
              keyboardType: TextInputType.number,
            ),
          ),
          IconButton(
            icon: const Icon(LucideIcons.save, color: Colors.green),
            onPressed: () => _saveSetting(key),
          ),
        ],
      ),
    );
  }
}
