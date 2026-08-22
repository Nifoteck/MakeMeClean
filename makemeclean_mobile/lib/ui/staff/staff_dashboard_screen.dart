import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/shift_model.dart';
import '../../data/services/supabase_service.dart';
import '../shared/custom_button.dart';
import '../shared/loading_indicator.dart';
import '../shared/notification_modal.dart';

class StaffDashboardScreen extends StatefulWidget {
  const StaffDashboardScreen({super.key});

  @override
  State<StaffDashboardScreen> createState() => _StaffDashboardScreenState();
}

class _StaffDashboardScreenState extends State<StaffDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<ShiftModel> _openShifts = [];
  List<ShiftModel> _myRoster = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final userId = SupabaseService.instance.currentUser?.id ?? 'cleaner';
    final open = await SupabaseService.instance.getOpenShifts();
    final roster = await SupabaseService.instance.getCleanerRoster(userId);

    if (mounted) {
      setState(() {
        _openShifts = open;
        _myRoster = roster;
        _isLoading = false;
      });
    }
  }

  Future<void> _claimShift(ShiftModel shift) async {
    final noteController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primarySurface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.hand, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 12),
            const Text(
              'Claim Clean Slot',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${shift.serviceName} in ${shift.city} (${shift.postcode})',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text(
              '${DateFormat('EEE, d MMM').format(shift.scheduledDate)} • ${shift.timeSlot}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primarySurface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Cleaner Pay:',
                    style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary),
                  ),
                  Text(
                    Formatters.currency(shift.payAmount),
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: noteController,
              decoration: InputDecoration(
                hintText: 'Optional note to manager/admin...',
                hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Apply for Slot'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await SupabaseService.instance.claimShift(shift, notes: noteController.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.primary,
            content: Text('Shift claimed! Awaiting admin confirmation.'),
          ),
        );
        _loadData();
      }
    }
  }

  Future<void> _openMap(String postcode, String city) async {
    final query = Uri.encodeComponent('$postcode, $city, UK');
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _toggleChecklistItem(ShiftModel shift, String item) async {
    final updated = List<String>.from(shift.completedChecklist);
    if (updated.contains(item)) {
      updated.remove(item);
    } else {
      updated.add(item);
    }
    await SupabaseService.instance.updateShiftChecklist(shift.id, updated);
    setState(() {
      final idx = _myRoster.indexWhere((s) => s.id == shift.id);
      if (idx != -1) {
        _myRoster[idx] = _myRoster[idx].copyWith(completedChecklist: updated);
      }
    });
  }

  double get _totalEarnings {
    return _myRoster
        .where((s) => s.status == 'completed' || s.status == 'confirmed')
        .fold(0.0, (acc, s) => acc + s.payAmount);
  }

  double get _totalHours {
    return _myRoster
        .where((s) => s.status == 'completed' || s.status == 'confirmed')
        .fold(0.0, (acc, s) => acc + s.estimatedHours);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primarySurface,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                children: [
                  Icon(LucideIcons.sparkles, color: AppColors.primary, size: 14),
                  SizedBox(width: 4),
                  Text(
                    'Cleaner Portal',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.bell, color: AppColors.textPrimary),
            onPressed: () => NotificationModal.show(context),
          ),
          IconButton(
            icon: const Icon(LucideIcons.logOut, color: AppColors.statusCancelledText),
            onPressed: () => SupabaseService.instance.signOut(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [
            Tab(
              child: Row(
                children: [
                  const Text('Open Shifts'),
                  if (_openShifts.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${_openShifts.length}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Tab(text: 'My Roster'),
            const Tab(text: 'Active Checklist'),
            const Tab(text: 'Earnings (£)'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: LoadingIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildOpenShiftsTab(),
                _buildMyRosterTab(),
                _buildActiveChecklistTab(),
                _buildEarningsTab(),
              ],
            ),
    );
  }

  // ─── Tab 1: Open Shifts Pool ───────────────────────────────────────────────
  Widget _buildOpenShiftsTab() {
    if (_openShifts.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.calendarCheck, size: 48, color: AppColors.textMuted.withValues(alpha: 0.5)),
              const SizedBox(height: 16),
              const Text(
                'No Open Shifts Right Now',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              const Text(
                'New customer cleans are posted here in real-time. Check back soon!',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _openShifts.length,
        separatorBuilder: (_, _) => const SizedBox(height: 14),
        itemBuilder: (context, index) {
          final shift = _openShifts[index];
          return Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.cardBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Row: Service & Pay Badge
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          shift.serviceName,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          Formatters.currency(shift.payAmount),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Location & City
                  Row(
                    children: [
                      const Icon(LucideIcons.mapPin, size: 15, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        '${shift.city} (${shift.postcode})',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                      ),
                      const Spacer(),
                      const Icon(LucideIcons.clock, size: 15, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        '${shift.estimatedHours} hrs',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Schedule Date & Slot
                  Row(
                    children: [
                      const Icon(LucideIcons.calendar, size: 15, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        '${DateFormat('EEE, d MMM yyyy').format(shift.scheduledDate)} • ${shift.timeSlot}',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ],
                  ),

                  if (shift.customerNotes != null && shift.customerNotes!.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          const Icon(LucideIcons.info, size: 14, color: AppColors.textMuted),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              shift.customerNotes!,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),
                  CustomButton(
                    text: 'Claim Shift Slot',
                    icon: const Icon(LucideIcons.hand, size: 18, color: Colors.white),
                    onPressed: () => _claimShift(shift),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── Tab 2: My Roster (Pending & Confirmed) ────────────────────────────────
  Widget _buildMyRosterTab() {
    if (_myRoster.isEmpty) {
      return const Center(
        child: Text('No active shifts on your schedule.'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _myRoster.length,
      separatorBuilder: (_, _) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final shift = _myRoster[index];
        final isConfirmed = shift.status == 'confirmed';

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isConfirmed ? AppColors.primary.withValues(alpha: 0.3) : AppColors.cardBorder,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        shift.serviceName,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isConfirmed ? AppColors.statusCompletedBg : AppColors.statusPendingBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        isConfirmed ? 'Confirmed' : 'Pending Approval',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: isConfirmed ? AppColors.statusCompletedText : AppColors.statusPendingText,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  '${DateFormat('EEEE, d MMMM').format(shift.scheduledDate)} at ${shift.timeSlot}',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 6),
                Text(
                  '${shift.address}, ${shift.city} (${shift.postcode})',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Text(
                      'Pay: ${Formatters.currency(shift.payAmount)}',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary),
                    ),
                    const Spacer(),
                    if (isConfirmed)
                      ElevatedButton.icon(
                        icon: const Icon(LucideIcons.navigation, size: 15),
                        label: const Text('Get Directions'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primarySurface,
                          foregroundColor: AppColors.primary,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () => _openMap(shift.postcode, shift.city),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ─── Tab 3: Active Job Checklist ───────────────────────────────────────────
  Widget _buildActiveChecklistTab() {
    final activeShift = _myRoster.firstWhere(
      (s) => s.status == 'confirmed' || s.status == 'in_progress',
      orElse: () => _myRoster.isNotEmpty ? _myRoster.first : _openShifts.first,
    );

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(LucideIcons.clipboardCheck, color: Colors.white, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'On-Site Cleaning Checklist',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  activeShift.serviceName,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${activeShift.address}, ${activeShift.city}',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text(
            'Room Tasks & Quality Check',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),

          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: activeShift.checklist.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, idx) {
              final item = activeShift.checklist[idx];
              final isDone = activeShift.completedChecklist.contains(item);

              return InkWell(
                onTap: () => _toggleChecklistItem(activeShift, item),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDone ? AppColors.primarySurface : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isDone ? AppColors.primary : AppColors.cardBorder,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isDone ? LucideIcons.circleCheck : LucideIcons.circle,
                        color: isDone ? AppColors.primary : AppColors.textMuted,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          item,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            decoration: isDone ? TextDecoration.lineThrough : null,
                            color: isDone ? AppColors.primaryDark : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 24),

          CustomButton(
            text: 'Mark Clean as Completed',
            icon: const Icon(LucideIcons.checkCheck, size: 18, color: Colors.white),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  backgroundColor: AppColors.primary,
                  content: Text('Job marked as completed! Payment queued for payout.'),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // ─── Tab 4: Earnings & Pay Tracker ─────────────────────────────────────────
  Widget _buildEarningsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Total Earned (This Month)',
                      style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    Icon(LucideIcons.wallet, color: Colors.white70, size: 18),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  Formatters.currency(_totalEarnings),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 16),
                const Divider(color: Colors.white24),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Hours Worked: ${_totalHours.toStringAsFixed(1)}h',
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    const Text(
                      'Payout: Weekly Friday',
                      style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'UK Direct Bank Payouts',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                SizedBox(height: 8),
                Text(
                  'MakeMeClean pays cleaners directly into UK bank accounts via Faster Payments every Friday for all completed shifts.',
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
