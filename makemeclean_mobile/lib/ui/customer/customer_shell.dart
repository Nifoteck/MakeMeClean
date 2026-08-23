import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/constants/app_colors.dart';
import '../../data/services/supabase_service.dart';
import 'dashboard_screen.dart';
import 'booking_wizard_screen.dart';
import 'bookings_list_screen.dart';
import 'loyalty_screen.dart';
import 'plans_screen.dart';
import 'profile_screen.dart';

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _currentIndex = 0;
  final List<int> _tabVersions = List.filled(6, 0);
  bool _loyaltyEnabled = false;

  @override
  void initState() {
    super.initState();
    _checkLoyaltySetting();
  }

  Future<void> _checkLoyaltySetting() async {
    final settings = await SupabaseService.instance.adminGetSettings();
    if (mounted) {
      setState(() {
        _loyaltyEnabled = settings['loyalty_enabled'] == 'true';
      });
    }
  }

  void _onNavigateTab(int index) {
    setState(() {
      _currentIndex = index;
      if (index < _tabVersions.length) {
        _tabVersions[index]++;
      }
    });
  }

  void _onTapTab(int index) {
    setState(() {
      _currentIndex = index;
      if (index < _tabVersions.length) {
        _tabVersions[index]++;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      DashboardScreen(
        key: ValueKey('dashboard-${_tabVersions[0]}'),
        onNavigateTab: _onNavigateTab,
      ),
      BookingWizardScreen(
        key: ValueKey('book-${_tabVersions[1]}'),
        onNavigateTab: _onNavigateTab,
      ),
      BookingsListScreen(
        key: ValueKey('bookings-${_tabVersions[2]}'),
        onNavigateTab: _onNavigateTab,
      ),
      PlansScreen(
        key: ValueKey('plans-${_tabVersions[3]}'),
        onNavigateTab: _onNavigateTab,
      ),
      if (_loyaltyEnabled)
        LoyaltyScreen(key: ValueKey('loyalty-${_tabVersions[4]}')),
      const ProfileScreen(),
    ];

    final effectiveIndex = _currentIndex >= screens.length ? 0 : _currentIndex;

    final navItems = [
      const BottomNavigationBarItem(
        icon: Icon(LucideIcons.layoutDashboard, size: 20),
        activeIcon: Icon(
          LucideIcons.layoutDashboard,
          size: 20,
          color: AppColors.primary,
        ),
        label: 'Dashboard',
      ),
      const BottomNavigationBarItem(
        icon: Icon(LucideIcons.plusCircle, size: 20),
        activeIcon: Icon(
          LucideIcons.plusCircle,
          size: 20,
          color: AppColors.primary,
        ),
        label: 'Book Clean',
      ),
      const BottomNavigationBarItem(
        icon: Icon(LucideIcons.calendar, size: 20),
        activeIcon: Icon(
          LucideIcons.calendar,
          size: 20,
          color: AppColors.primary,
        ),
        label: 'Bookings',
      ),
      const BottomNavigationBarItem(
        icon: Icon(LucideIcons.repeat, size: 20),
        activeIcon: Icon(
          LucideIcons.repeat,
          size: 20,
          color: AppColors.primary,
        ),
        label: 'Plans',
      ),
      if (_loyaltyEnabled)
        const BottomNavigationBarItem(
          icon: Icon(LucideIcons.trophy, size: 20),
          activeIcon: Icon(
            LucideIcons.trophy,
            size: 20,
            color: AppColors.primary,
          ),
          label: 'Rewards',
        ),
      const BottomNavigationBarItem(
        icon: Icon(LucideIcons.user, size: 20),
        activeIcon: Icon(
          LucideIcons.user,
          size: 20,
          color: AppColors.primary,
        ),
        label: 'Profile',
      ),
    ];

    return Scaffold(
      body: IndexedStack(index: effectiveIndex, children: screens),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.borderLight)),
        ),
        child: BottomNavigationBar(
          currentIndex: effectiveIndex,
          onTap: _onTapTab,
          items: navItems,
        ),
      ),
    );
  }
}
