import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/services/supabase_service.dart';
import '../shared/loading_indicator.dart';
import '../shared/notification_modal.dart';

enum AdminSection {
  bookings('Bookings', LucideIcons.layoutDashboard, 'Manage customer cleans & assignments'),
  applicants('Applicants', LucideIcons.usersRound, 'Cleaner job applications & hiring'),
  staff('Staff', LucideIcons.briefcaseBusiness, 'Active cleaners & team management'),
  services('Services', LucideIcons.sparkles, 'Service catalog & pricing rates'),
  payroll('Payroll', LucideIcons.banknote, 'Friday cleaner payouts & hours'),
  reschedules('Reschedules', LucideIcons.calendarClock, 'Customer reschedule requests'),
  plans('Plans', LucideIcons.repeat, 'Recurring cleaning subscriptions'),
  messages('Messages', LucideIcons.messageSquare, 'Customer contact enquiries'),
  refunds('Refunds', LucideIcons.dollarSign, 'Refund requests & adjustments'),
  photos('Photos', LucideIcons.image, 'Before & After clean QA photos'),
  loyalty('Loyalty', LucideIcons.trophy, 'Customer points & VIP tiers'),
  settings('Settings', LucideIcons.settings, 'Service coverage & system configuration');

  final String label;
  final IconData icon;
  final String subtitle;

  const AdminSection(this.label, this.icon, this.subtitle);
}

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  AdminSection _currentSection = AdminSection.bookings;
  bool _isLoading = true;

  // Real Database Lists (0 mock data)
  List<Map<String, dynamic>> _bookings = [];
  List<Map<String, dynamic>> _applicants = [];
  List<Map<String, dynamic>> _staff = [];
  List<Map<String, dynamic>> _services = [];
  List<Map<String, dynamic>> _payroll = [];
  List<Map<String, dynamic>> _reschedules = [];
  List<Map<String, dynamic>> _plans = [];
  List<Map<String, dynamic>> _messages = [];
  List<Map<String, dynamic>> _refunds = [];
  List<Map<String, dynamic>> _photos = [];
  List<Map<String, dynamic>> _loyalty = [];
  List<Map<String, dynamic>> _cities = [];
  Map<String, String> _settings = {};

  String _searchQuery = '';
  String _bookingStatusFilter = 'all';

  final _newCityController = TextEditingController();
  final String _newCityRegion = 'South Wales';

  @override
  void initState() {
    super.initState();
    _loadAllRealData();
  }

  @override
  void dispose() {
    _newCityController.dispose();
    super.dispose();
  }

  Future<void> _loadAllRealData() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      SupabaseService.instance.adminGetBookings(),
      SupabaseService.instance.adminGetApplicants(),
      SupabaseService.instance.adminGetStaff(),
      SupabaseService.instance.adminGetServices(),
      SupabaseService.instance.adminGetPayrollRuns(),
      SupabaseService.instance.adminGetReschedules(),
      SupabaseService.instance.adminGetPlans(),
      SupabaseService.instance.adminGetMessages(),
      SupabaseService.instance.adminGetRefunds(),
      SupabaseService.instance.adminGetCleanPhotos(),
      SupabaseService.instance.adminGetLoyaltyRecords(),
      SupabaseService.instance.adminGetAllCities(),
      SupabaseService.instance.adminGetSettings(),
    ]);

    if (mounted) {
      setState(() {
        _bookings = results[0] as List<Map<String, dynamic>>;
        _applicants = results[1] as List<Map<String, dynamic>>;
        _staff = results[2] as List<Map<String, dynamic>>;
        _services = results[3] as List<Map<String, dynamic>>;
        _payroll = results[4] as List<Map<String, dynamic>>;
        _reschedules = results[5] as List<Map<String, dynamic>>;
        _plans = results[6] as List<Map<String, dynamic>>;
        _messages = results[7] as List<Map<String, dynamic>>;
        _refunds = results[8] as List<Map<String, dynamic>>;
        _photos = results[9] as List<Map<String, dynamic>>;
        _loyalty = results[10] as List<Map<String, dynamic>>;
        _cities = results[11] as List<Map<String, dynamic>>;
        _settings = results[12] as Map<String, String>;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _currentSection.label,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: AppColors.textPrimary,
              ),
            ),
            Text(
              _currentSection.subtitle,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.bell, size: 20, color: AppColors.textPrimary),
            onPressed: () => NotificationModal.show(context),
          ),
          IconButton(
            icon: const Icon(LucideIcons.logOut, size: 20, color: AppColors.statusCancelledText),
            onPressed: () => SupabaseService.instance.signOut(),
          ),
        ],
      ),
      drawer: _buildAdminDrawer(),
      body: _isLoading
          ? const Center(child: LoadingIndicator(message: 'Loading back office...'))
          : RefreshIndicator(
              onRefresh: _loadAllRealData,
              color: AppColors.primary,
              child: _buildSectionContent(),
            ),
    );
  }

  // ─── Admin Drawer Navigation (Matches Web AdminLayout) ─────────────────────
  Widget _buildAdminDrawer() {
    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            // Drawer Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MakeMeClean',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        'Back Office Management',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // 12 Navigation Items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                children: AdminSection.values.map((section) {
                  final isActive = _currentSection == section;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    decoration: BoxDecoration(
                      color: isActive ? AppColors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListTile(
                      dense: true,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      leading: Icon(
                        section.icon,
                        size: 19,
                        color: isActive ? Colors.white : AppColors.textSecondary,
                      ),
                      title: Text(
                        section.label,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                          color: isActive ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                      trailing: isActive
                          ? const Icon(LucideIcons.chevronRight, size: 16, color: Colors.white70)
                          : null,
                      onTap: () {
                        setState(() => _currentSection = section);
                        Navigator.pop(context); // close drawer
                      },
                    ),
                  );
                }).toList(),
              ),
            ),

            // Drawer Footer
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
              ),
              child: ListTile(
                dense: true,
                leading: const Icon(LucideIcons.logOut, size: 18, color: AppColors.statusCancelledText),
                title: const Text('Sign Out', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.statusCancelledText)),
                onTap: () => SupabaseService.instance.signOut(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Section Content Dispatcher ───────────────────────────────────────────
  Widget _buildSectionContent() {
    switch (_currentSection) {
      case AdminSection.bookings:
        return _buildBookingsSection();
      case AdminSection.applicants:
        return _buildApplicantsSection();
      case AdminSection.staff:
        return _buildStaffSection();
      case AdminSection.services:
        return _buildServicesSection();
      case AdminSection.payroll:
        return _buildPayrollSection();
      case AdminSection.reschedules:
        return _buildReschedulesSection();
      case AdminSection.plans:
        return _buildPlansSection();
      case AdminSection.messages:
        return _buildMessagesSection();
      case AdminSection.refunds:
        return _buildRefundsSection();
      case AdminSection.photos:
        return _buildPhotosSection();
      case AdminSection.loyalty:
        return _buildLoyaltySection();
      case AdminSection.settings:
        return _buildSettingsSection();
    }
  }

  // ─── 1. Bookings Management ────────────────────────────────────────────────
  Widget _buildBookingsSection() {
    final filtered = _bookings.where((b) {
      final status = (b['status']?.toString() ?? '').toLowerCase();
      if (_bookingStatusFilter != 'all' && status != _bookingStatusFilter) return false;
      if (_searchQuery.isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      final name = (b['profiles']?['full_name']?.toString() ?? '').toLowerCase();
      final city = (b['city']?.toString() ?? '').toLowerCase();
      final postcode = (b['postcode']?.toString() ?? '').toLowerCase();
      return name.contains(q) || city.contains(q) || postcode.contains(q);
    }).toList();

    return Column(
      children: [
        // Search & Status Filters
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            children: [
              TextField(
                decoration: InputDecoration(
                  hintText: 'Search customer, city or postcode...',
                  prefixIcon: const Icon(LucideIcons.search, size: 18),
                  filled: true,
                  fillColor: AppColors.background,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: AppColors.border),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                onChanged: (val) => setState(() => _searchQuery = val),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['all', 'upcoming', 'in_progress', 'completed', 'cancelled'].map((status) {
                    final selected = _bookingStatusFilter == status;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(status.toUpperCase().replaceAll('_', ' ')),
                        selected: selected,
                        selectedColor: AppColors.primary,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppColors.textPrimary,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                        onSelected: (_) => setState(() => _bookingStatusFilter = status),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),

        // List
        Expanded(
          child: filtered.isEmpty
              ? _buildEmptyState('No bookings found for this filter.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final b = filtered[index];
                    final customerName = b['profiles']?['full_name'] ?? 'Customer';
                    final customerPhone = b['profiles']?['phone'] ?? '';
                    final price = (b['price'] as num?)?.toDouble() ?? 0.0;
                    final status = b['status']?.toString() ?? 'upcoming';
                    final date = b['date']?.toString() ?? '';
                    final timeSlot = b['time_slot']?.toString() ?? '';

                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.cardBorder),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  b['service_name'] ?? 'Cleaning Service',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppColors.primarySurface,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  status.toUpperCase(),
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.primary),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '$customerName • ${Formatters.date(date)} ($timeSlot)',
                            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          ),
                          if (customerPhone.isNotEmpty)
                            Text(
                              '📞 $customerPhone',
                              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                            ),
                          const SizedBox(height: 4),
                          Text(
                            '📍 ${b['address'] ?? ''}, ${b['city'] ?? ''} (${b['postcode'] ?? ''})',
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                Formatters.currency(price),
                                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppColors.primary),
                              ),
                              Row(
                                children: [
                                  if (status != 'completed')
                                    TextButton(
                                      onPressed: () async {
                                        await SupabaseService.instance.adminUpdateBookingStatus(b['id'], 'completed');
                                        _loadAllRealData();
                                      },
                                      child: const Text('Complete', style: TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.w800)),
                                    ),
                                  if (status != 'cancelled')
                                    TextButton(
                                      onPressed: () async {
                                        await SupabaseService.instance.adminUpdateBookingStatus(b['id'], 'cancelled');
                                        _loadAllRealData();
                                      },
                                      child: const Text('Cancel', style: TextStyle(color: AppColors.statusCancelledText, fontWeight: FontWeight.w800)),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ─── 2. Applicants Management ──────────────────────────────────────────────
  Widget _buildApplicantsSection() {
    if (_applicants.isEmpty) return _buildEmptyState('No cleaner job applications yet.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _applicants.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final a = _applicants[index];
        final name = '${a['first_name'] ?? ''} ${a['last_name'] ?? ''}'.trim();
        final email = a['email'] ?? '';
        final phone = a['phone'] ?? '';
        final status = a['status']?.toString() ?? 'new';
        final experience = a['experience'] ?? 'Not specified';

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(name.isNotEmpty ? name : 'Applicant', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(status.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.primary)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text('📧 $email • 📞 $phone', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 4),
              Text('Experience: $experience', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () async {
                      await SupabaseService.instance.adminUpdateApplicantStatus(a['id'], 'rejected');
                      _loadAllRealData();
                    },
                    child: const Text('Reject', style: TextStyle(color: AppColors.statusCancelledText)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                    onPressed: () async {
                      await SupabaseService.instance.adminUpdateApplicantStatus(a['id'], 'accepted');
                      _loadAllRealData();
                    },
                    child: const Text('Accept Cleaner', style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 3. Staff Directory ───────────────────────────────────────────────────
  Widget _buildStaffSection() {
    if (_staff.isEmpty) return _buildEmptyState('No staff members registered in database.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _staff.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final s = _staff[index];
        final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
        final email = s['email'] ?? '';
        final active = s['active'] == true;
        final rate = (s['hourly_rate'] as num?)?.toDouble() ?? 14.50;

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: active ? AppColors.primarySurface : AppColors.background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(LucideIcons.userCheck, color: active ? AppColors.primary : AppColors.textMuted),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name.isNotEmpty ? name : 'Cleaner', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                    Text(email, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    Text('Rate: ${Formatters.currency(rate)}/hr', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  ],
                ),
              ),
              Switch(
                value: active,
                activeThumbColor: AppColors.primary,
                onChanged: (_) async {
                  await SupabaseService.instance.adminToggleStaffActive(s['id'], active);
                  _loadAllRealData();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 4. Services Catalog ──────────────────────────────────────────────────
  Widget _buildServicesSection() {
    if (_services.isEmpty) return _buildEmptyState('No services in database.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _services.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final s = _services[index];
        final name = s['name'] ?? 'Service';
        final price = (s['price'] as num?)?.toDouble() ?? 0.0;
        final discount = (s['discount_percent'] as num?)?.toInt() ?? 0;
        final active = s['active'] == true;

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text('${Formatters.currency(price)} / hour • $discount% off', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              Switch(
                value: active,
                activeThumbColor: AppColors.primary,
                onChanged: (_) async {
                  await SupabaseService.instance.adminToggleServiceActive(s['id'], active);
                  _loadAllRealData();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 5. Payroll Management ────────────────────────────────────────────────
  Widget _buildPayrollSection() {
    if (_payroll.isEmpty) return _buildEmptyState('No payroll records found for completed weeks.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _payroll.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final p = _payroll[index];
        final cleanerName = '${p['staff']?['first_name'] ?? ''} ${p['staff']?['last_name'] ?? ''}'.trim();
        final amount = (p['total_pay'] as num?)?.toDouble() ?? 0.0;
        final hours = (p['hours_worked'] as num?)?.toDouble() ?? 0.0;

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(cleanerName.isNotEmpty ? cleanerName : 'Cleaner', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('$hours hours logged', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                ],
              ),
              Text(
                Formatters.currency(amount),
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppColors.primary),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 6. Reschedule Requests ───────────────────────────────────────────────
  Widget _buildReschedulesSection() {
    if (_reschedules.isEmpty) return _buildEmptyState('No pending reschedule requests from customers.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _reschedules.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final r = _reschedules[index];
        final newDate = r['requested_date'] ?? '';
        final status = r['status'] ?? 'pending';

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Requested Date: $newDate', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Status: ${status.toUpperCase()}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () async {
                      await SupabaseService.instance.adminUpdateRescheduleStatus(r['id'], 'declined');
                      _loadAllRealData();
                    },
                    child: const Text('Decline'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                    onPressed: () async {
                      await SupabaseService.instance.adminUpdateRescheduleStatus(r['id'], 'approved');
                      _loadAllRealData();
                    },
                    child: const Text('Approve Reschedule', style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 7. Plans (Subscriptions) ─────────────────────────────────────────────
  Widget _buildPlansSection() {
    if (_plans.isEmpty) return _buildEmptyState('No recurring cleaning subscriptions active.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _plans.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final plan = _plans[index];
        final customer = plan['profiles']?['full_name'] ?? 'Subscriber';
        final freq = plan['frequency'] ?? 'Weekly';

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(customer, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('Plan: $freq', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('ACTIVE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.primary)),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 8. Messages (Contact Inquiries) ──────────────────────────────────────
  Widget _buildMessagesSection() {
    if (_messages.isEmpty) return _buildEmptyState('No contact inquiries received.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _messages.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final m = _messages[index];
        final name = m['name'] ?? 'Visitor';
        final email = m['email'] ?? '';
        final message = m['message'] ?? '';
        final isRead = m['is_read'] == true;

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                  Text(email, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
              const SizedBox(height: 8),
              Text(message, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () async {
                      await SupabaseService.instance.adminMarkMessageRead(m['id'], !isRead);
                      _loadAllRealData();
                    },
                    child: Text(isRead ? 'Mark as Unread' : 'Mark as Read'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 9. Refunds ───────────────────────────────────────────────────────────
  Widget _buildRefundsSection() {
    if (_refunds.isEmpty) return _buildEmptyState('No refund requests logged.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _refunds.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final r = _refunds[index];
        final amount = (r['amount'] as num?)?.toDouble() ?? 0.0;
        final reason = r['reason'] ?? 'No reason provided';
        final status = r['status'] ?? 'pending';

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(Formatters.currency(amount), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppColors.primary)),
                  Text(status.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textSecondary)),
                ],
              ),
              const SizedBox(height: 6),
              Text('Reason: $reason', style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () async {
                      await SupabaseService.instance.adminUpdateRefundStatus(r['id'], 'declined');
                      _loadAllRealData();
                    },
                    child: const Text('Decline'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                    onPressed: () async {
                      await SupabaseService.instance.adminUpdateRefundStatus(r['id'], 'approved');
                      _loadAllRealData();
                    },
                    child: const Text('Approve Refund', style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 10. Photos QA ────────────────────────────────────────────────────────
  Widget _buildPhotosSection() {
    if (_photos.isEmpty) return _buildEmptyState('No clean photos uploaded by staff yet.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _photos.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final p = _photos[index];
        final url = p['photo_url']?.toString() ?? '';
        final type = p['type']?.toString() ?? 'clean';

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Type: ${type.toUpperCase()}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              if (url.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(url, height: 180, width: double.infinity, fit: BoxFit.cover),
                ),
            ],
          ),
        );
      },
    );
  }

  // ─── 11. Loyalty Points ───────────────────────────────────────────────────
  Widget _buildLoyaltySection() {
    if (_loyalty.isEmpty) return _buildEmptyState('No customer loyalty records found.');

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _loyalty.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final user = _loyalty[index];
        final name = user['full_name'] ?? 'Customer';
        final email = user['email'] ?? '';
        final points = (user['loyalty_points'] as num?)?.toInt() ?? 0;
        final tier = user['tier'] ?? 'Standard';

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                  Text(email, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  Text('Tier: $tier', style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w700)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('$points PTS', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.primary)),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── 12. Settings & Service Cities ────────────────────────────────────────
  Widget _buildSettingsSection() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Service Cities Coverage Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Service Locations (Wales)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                    Text('${_cities.where((c) => c['is_active'] == true).length} Active', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.primary)),
                  ],
                ),
                const SizedBox(height: 6),
                const Text('Tap any city to immediately open or close booking service.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _cities.map((city) {
                    final isActive = city['is_active'] == true;
                    return InkWell(
                      onTap: () async {
                        await SupabaseService.instance.adminToggleCity(city['id'], isActive);
                        _loadAllRealData();
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: isActive ? AppColors.primarySurface : AppColors.background,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: isActive ? AppColors.primary : AppColors.border),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(city['name'] ?? '', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isActive ? AppColors.primaryDark : AppColors.textSecondary)),
                            const SizedBox(width: 4),
                            Icon(isActive ? LucideIcons.circleCheck : LucideIcons.circleX, size: 13, color: isActive ? AppColors.primary : AppColors.textMuted),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _newCityController,
                        decoration: InputDecoration(
                          hintText: 'Add new city / town...',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                      onPressed: () async {
                        if (_newCityController.text.trim().isEmpty) return;
                        await SupabaseService.instance.adminAddCity(_newCityController.text.trim(), _newCityRegion);
                        _newCityController.clear();
                        _loadAllRealData();
                      },
                      child: const Text('Add', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // System Settings Card
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('System Configuration & Info', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(LucideIcons.phone, size: 18, color: AppColors.primary),
                  title: const Text('Business Phone', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  subtitle: Text(_settings['business_phone'] ?? '+44 (0) 7900 000000', style: const TextStyle(fontSize: 12)),
                ),
                const Divider(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(LucideIcons.mail, size: 18, color: AppColors.primary),
                  title: const Text('Contact Email', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  subtitle: Text(_settings['contact_email'] ?? 'info@makemeclean.co.uk', style: const TextStyle(fontSize: 12)),
                ),
                const Divider(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(LucideIcons.percent, size: 18, color: AppColors.primary),
                  title: const Text('Recurring Discounts', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  subtitle: const Text('Weekly: 15% • Fortnightly: 10% • Monthly: 5%', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.inbox, size: 44, color: AppColors.textMuted.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
