import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/constants/app_colors.dart';
import 'dashboard_screen.dart';
import 'booking_wizard_screen.dart';
import 'bookings_list_screen.dart';
import 'loyalty_screen.dart';
import 'profile_screen.dart';

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _currentIndex = 0;

  void _onNavigateTab(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      DashboardScreen(onNavigateTab: _onNavigateTab),
      BookingWizardScreen(onNavigateTab: _onNavigateTab),
      BookingsListScreen(onNavigateTab: _onNavigateTab),
      const LoyaltyScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.borderLight)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.layoutDashboard, size: 20),
              activeIcon: Icon(LucideIcons.layoutDashboard, size: 20, color: AppColors.primary),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.plusCircle, size: 20),
              activeIcon: Icon(LucideIcons.plusCircle, size: 20, color: AppColors.primary),
              label: 'Book Clean',
            ),
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.calendar, size: 20),
              activeIcon: Icon(LucideIcons.calendar, size: 20, color: AppColors.primary),
              label: 'Bookings',
            ),
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.trophy, size: 20),
              activeIcon: Icon(LucideIcons.trophy, size: 20, color: AppColors.primary),
              label: 'Rewards',
            ),
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.user, size: 20),
              activeIcon: Icon(LucideIcons.user, size: 20, color: AppColors.primary),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}

