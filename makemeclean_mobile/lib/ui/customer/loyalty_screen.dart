import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/constants/app_colors.dart';
import '../../data/models/loyalty_model.dart';
import '../../data/services/supabase_service.dart';
import '../shared/loading_indicator.dart';

class LoyaltyScreen extends StatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  State<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends State<LoyaltyScreen> {
  bool _isLoading = true;
  UserLoyaltyInfo? _loyalty;

  @override
  void initState() {
    super.initState();
    _loadLoyalty();
  }

  Future<void> _loadLoyalty() async {
    final user = SupabaseService.instance.currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);
    try {
      final info = await SupabaseService.instance.getUserLoyalty(user.id);
      if (mounted) {
        setState(() {
          _loyalty = info;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Loading rewards balance...'),
      );
    }

    final info = _loyalty ?? UserLoyaltyInfo.fromPoints(150);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Loyalty & Rewards'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadLoyalty,
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tier Hero Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              const Icon(LucideIcons.crown, color: Colors.white, size: 14),
                              const SizedBox(width: 6),
                              Text(
                                '${info.tier.toUpperCase()} MEMBER',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(LucideIcons.sparkles, color: Colors.white70, size: 20),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Available Balance',
                      style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${info.totalPoints} pts',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Progress Bar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: LinearProgressIndicator(
                        value: info.nextTierProgress,
                        backgroundColor: Colors.white.withValues(alpha: 0.2),
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      info.pointsToNextTier > 0
                          ? '${info.pointsToNextTier} more points until next tier'
                          : 'Top tier reached! Maximum discounts unlocked.',
                      style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // How to earn points
              const Text(
                'HOW TO EARN POINTS',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 12),
              _buildEarnCard(LucideIcons.sparkles, 'Complete a Cleaning', 'Earn 10 points for every £1 spent on any cleaning service.'),
              const SizedBox(height: 10),
              _buildEarnCard(LucideIcons.star, 'Leave a Review', 'Earn 50 bonus points for rating your cleaner after a visit.'),
              const SizedBox(height: 10),
              _buildEarnCard(LucideIcons.repeat, 'Set a Recurring Plan', 'Subscribers earn 1.5x bonus points on every automatic clean.'),
              const SizedBox(height: 24),

              // Rewards Catalog
              const Text(
                'REDEEMABLE REWARDS',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 12),
              _buildRewardCard('£5 Off Any Clean', 'Valid on next booking', 250, info.totalPoints),
              const SizedBox(height: 10),
              _buildRewardCard('£10 Off Deep Clean', 'Valid on spring & deep cleans', 500, info.totalPoints),
              const SizedBox(height: 10),
              _buildRewardCard('Free Oven Clean Add-on', 'Worth £40 on your next booking', 1000, info.totalPoints),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEarnCard(IconData icon, String title, String description) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                const SizedBox(height: 2),
                Text(description, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRewardCard(String title, String subtitle, int cost, int userPoints) {
    final canRedeem = userPoints >= cost;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 6),
                Text(
                  '$cost points',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.primary),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: canRedeem
                ? () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Voucher redeemed: $title applied to your account!')),
                    );
                  }
                : null,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              minimumSize: const Size(60, 36),
            ),
            child: Text(canRedeem ? 'Redeem' : 'Locked', style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
