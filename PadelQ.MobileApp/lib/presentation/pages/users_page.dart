import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:lucide_icons/lucide_icons.dart';

class UsersPage extends StatefulWidget {
  const UsersPage({super.key});

  @override
  State<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends State<UsersPage> {
  final List<Map<String, String>> _users = [
    {'name': 'Admin', 'email': 'admin@padelq.com', 'role': 'Admin'},
    {'name': 'Juan Pérez', 'email': 'juan@example.com', 'role': 'Jugador'},
  ];

  void _showUserForm([Map<String, String>? user]) {
    final nameController = TextEditingController(text: user?['name']);
    final emailController = TextEditingController(text: user?['email']);
    final roleController = TextEditingController(text: user?['role'] ?? 'Jugador');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24.r))),
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24.w, right: 24.w, top: 24.h),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(user == null ? 'Nuevo Usuario' : 'Editar Usuario', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.bold)),
            SizedBox(height: 20.h),
            TextField(controller: nameController, decoration: InputDecoration(labelText: 'Nombre Completo', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r)))),
            SizedBox(height: 16.h),
            TextField(controller: emailController, decoration: InputDecoration(labelText: 'Email', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r)))),
            SizedBox(height: 16.h),
            TextField(controller: roleController, decoration: InputDecoration(labelText: 'Rol', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r)))),
            SizedBox(height: 24.h),
            SizedBox(
              width: double.infinity,
              height: 50.h,
              child: ElevatedButton(
                onPressed: () {
                  setState(() {
                    if (user == null) {
                      _users.add({'name': nameController.text, 'email': emailController.text, 'role': roleController.text});
                    } else {
                      user['name'] = nameController.text;
                      user['email'] = emailController.text;
                      user['role'] = roleController.text;
                    }
                  });
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.blue.shade700, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r))),
                child: Text('Guardar'),
              ),
            ),
            SizedBox(height: 24.h),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Gestión de Usuarios', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(LucideIcons.userPlus), onPressed: () => _showUserForm()),
        ],
      ),
      body: ListView.builder(
        padding: EdgeInsets.all(16.w),
        itemCount: _users.length,
        itemBuilder: (context, index) {
          final user = _users[index];
          return Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r), side: BorderSide(color: Colors.grey.shade200)),
            margin: EdgeInsets.only(bottom: 12.h),
            child: ListTile(
              leading: CircleAvatar(backgroundColor: Colors.blue.shade100, child: Text(user['name']![0])),
              title: Text(user['name']!, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('${user['email']} • ${user['role']}'),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(icon: const Icon(LucideIcons.edit2, size: 20), onPressed: () => _showUserForm(user)),
                  IconButton(icon: const Icon(LucideIcons.trash2, size: 20, color: Colors.red), onPressed: () {
                    setState(() => _users.removeAt(index));
                  }),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
