import 'package:flutter/material.dart';
import '../../data/services/activity_service.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

class ActivitiesPage extends StatefulWidget {
  const ActivitiesPage({super.key});

  @override
  State<ActivitiesPage> createState() => _ActivitiesPageState();
}

class _ActivitiesPageState extends State<ActivitiesPage> {
  final ActivityService _activityService = ActivityService();
  List<dynamic> _activities = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadActivities();
  }

  Future<void> _loadActivities() async {
    setState(() => _isLoading = true);
    final activities = await _activityService.getActivities();
    setState(() {
      _activities = activities;
      _isLoading = false;
    });
  }

  Future<void> _handleSignup(int activityId, String activityName) async {
    final result = await _activityService.signup(activityId);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message']),
          backgroundColor: result['success'] ? Colors.green : Colors.red,
        ),
      );
      if (result['success']) {
        _loadActivities();
      }
    }
  }

  String _getDayName(int day) {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return day >= 0 && day < 7 ? days[day] : 'Desconocido';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Actividades y Clases'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadActivities,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _activities.isEmpty
              ? const Center(child: Text('No hay actividades disponibles'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _activities.length,
                  itemBuilder: (context, index) {
                    final activity = _activities[index];
                    final schedules = activity['schedules'] as List<dynamic>;
                    final currentSignups = activity['currentSignups'] ?? 0;
                    final maxCapacity = activity['maxCapacity'] ?? 0;
                    final isFull = currentSignups >= maxCapacity;

                    return Card(
                      elevation: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    activity['name'],
                                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                Text(
                                  '\$${activity['price']}',
                                  style: const TextStyle(fontSize: 18, color: Colors.blue, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              activity['description'] ?? 'Sin descripción',
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                const Icon(LucideIcons.users, size: 16, color: Colors.grey),
                                const SizedBox(width: 4),
                                Text('Profesor: ${activity['instructor'] ?? "N/A"}'),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(LucideIcons.users, size: 16, color: isFull ? Colors.red : Colors.green),
                                const SizedBox(width: 4),
                                Text(
                                  'Capacidad: $currentSignups / $maxCapacity',
                                  style: TextStyle(color: isFull ? Colors.red : Colors.green, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            const Text('Horarios:', style: TextStyle(fontWeight: FontWeight.bold)),
                            ...schedules.map((s) => Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Row(
                                    children: [
                                      const Icon(LucideIcons.clock, size: 14, color: Colors.grey),
                                      const SizedBox(width: 4),
                                      Text('${_getDayName(s['dayOfWeek'])} ${s['startTime'].substring(0, 5)} - ${s['endTime'].substring(0, 5)}'),
                                    ],
                                  ),
                                )),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: isFull ? null : () => _handleSignup(activity['id'], activity['name']),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.blue,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                child: Text(isFull ? 'AGOTADO' : 'INSCRIBIRME'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
