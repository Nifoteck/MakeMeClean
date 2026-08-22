import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../data/services/supabase_service.dart';
import '../customer/customer_shell.dart';
import '../staff/staff_dashboard_screen.dart';
import '../shared/loading_indicator.dart';
import 'login_screen.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: SupabaseService.instance.authStateChanges,
      builder: (context, snapshot) {
        final session = Supabase.instance.client.auth.currentSession;

        if (session == null) {
          return const LoginScreen();
        }

        return FutureBuilder<bool>(
          future: SupabaseService.instance.checkIsStaff(session.user.id),
          builder: (context, roleSnapshot) {
            if (roleSnapshot.connectionState == ConnectionState.waiting) {
              return const Scaffold(
                body: LoadingIndicator(message: 'Loading your portal...'),
              );
            }

            final isStaff = roleSnapshot.data == true;
            if (isStaff) {
              return const StaffDashboardScreen();
            }

            return const CustomerShell();
          },
        );
      },
    );
  }
}

