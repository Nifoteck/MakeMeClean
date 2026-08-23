import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/recurring_plan_model.dart';
import '../../data/services/supabase_service.dart';
import '../shared/custom_button.dart';
import '../shared/loading_indicator.dart';
import 'booking_wizard_screen.dart';

class PlansScreen extends StatefulWidget {
  final Function(int)? onNavigateTab;

  const PlansScreen({super.key, this.onNavigateTab});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  bool _isLoading = true;
  String? _actionId;
  List<RecurringPlanModel> _plans = [];

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    final user = SupabaseService.instance.currentUser;
    if (user == null) return;
    setState(() => _isLoading = true);
    try {
      final plans = await SupabaseService.instance.getUserRecurringPlans(
        user.id,
      );
      if (mounted) {
        setState(() {
          _plans = plans;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateStatus(String id, String status) async {
    setState(() => _actionId = id);
    try {
      await SupabaseService.instance.updateRecurringPlanStatus(id, status);
      await _loadPlans();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.statusCancelledText,
            content: Text('Could not update plan: $e'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _actionId = null);
    }
  }

  String _frequencyLabel(String frequency) {
    switch (frequency) {
      case 'weekly':
        return 'Every week';
      case 'fortnightly':
        return 'Every 2 weeks';
      case 'monthly':
        return 'Every month';
      default:
        return frequency;
    }
  }

  String _endTime(RecurringPlanModel plan) {
    final parts = plan.startTime.split(':').map(int.parse).toList();
    final endMins =
        parts[0] * 60 + parts[1] + (plan.durationHours * 60).round();
    final endH = (endMins ~/ 60).toString().padLeft(2, '0');
    final endM = (endMins % 60).toString().padLeft(2, '0');
    return '$endH:$endM';
  }

  String _formatHours(double hours) {
    return hours % 1 == 0 ? hours.toInt().toString() : hours.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Loading your plans...'),
      );
    }

    final activePlans = _plans.where((p) => p.status != 'cancelled').toList();
    final cancelledPlans = _plans
        .where((p) => p.status == 'cancelled')
        .toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('My Plans')),
      body: RefreshIndicator(
        onRefresh: _loadPlans,
        color: AppColors.primary,
        child: _plans.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 80),
                  const Icon(
                    LucideIcons.repeat,
                    size: 56,
                    color: AppColors.textMuted,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No recurring plans yet',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Set up a weekly, fortnightly, or monthly clean from the booking screen.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 24),
                  CustomButton(
                    text: 'Set Up a Plan',
                    onPressed: () {
                      if (widget.onNavigateTab != null) {
                        widget.onNavigateTab!(1);
                      } else {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const BookingWizardScreen(),
                          ),
                        );
                      }
                    },
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  ...activePlans.map(_buildPlanCard),
                  if (cancelledPlans.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    const Text(
                      'CANCELLED PLANS',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textMuted,
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...cancelledPlans.map(_buildPlanCard),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _buildPlanCard(RecurringPlanModel plan) {
    final isBusy = _actionId == plan.id;
    final isCancelled = plan.status == 'cancelled';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Opacity(
        opacity: isCancelled ? 0.55 : 1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        plan.serviceName,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          _pill(
                            _frequencyLabel(plan.frequency),
                            AppColors.primary,
                          ),
                          _pill(
                            plan.status.toUpperCase(),
                            AppColors.textSecondary,
                          ),
                          if (plan.discountPercent > 0)
                            _pill(
                              '${plan.discountPercent.toStringAsFixed(0)}% OFF',
                              const Color(0xFFEA580C),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'Per visit',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textMuted,
                      ),
                    ),
                    Text(
                      Formatters.currency(plan.pricePerVisit),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            _infoRow(
              LucideIcons.clock,
              '${plan.startTime} - ${_endTime(plan)} (${_formatHours(plan.durationHours)}h)',
            ),
            const SizedBox(height: 6),
            _infoRow(
              LucideIcons.mapPin,
              '${plan.address}, ${plan.city}, ${plan.postcode}',
            ),
            if (!isCancelled) ...[
              const Divider(height: 22),
              Row(
                children: [
                  if (plan.status == 'active')
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: isBusy
                            ? null
                            : () => _updateStatus(plan.id, 'paused'),
                        icon: const Icon(LucideIcons.pause, size: 16),
                        label: const Text('Pause'),
                      ),
                    )
                  else
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: isBusy
                            ? null
                            : () => _updateStatus(plan.id, 'active'),
                        icon: const Icon(LucideIcons.play, size: 16),
                        label: const Text('Resume'),
                      ),
                    ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: isBusy
                          ? null
                          : () => _updateStatus(plan.id, 'cancelled'),
                      icon: const Icon(LucideIcons.x, size: 16),
                      label: const Text('Cancel'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.statusCancelledText,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _pill(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
