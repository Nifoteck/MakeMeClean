import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final String? paymentStatus;

  const StatusBadge({super.key, required this.status, this.paymentStatus});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;
    String label;

    final isPaid = (paymentStatus ?? '').toLowerCase() == 'paid';
    final isCancelled = status.toLowerCase() == 'cancelled';

    if (!isPaid &&
        !isCancelled &&
        (status.toLowerCase() == 'upcoming' ||
            status.toLowerCase() == 'pending')) {
      bg = AppColors.statusPendingBg;
      text = AppColors.statusPendingText;
      label = 'PAYMENT PENDING';
    } else {
      switch (status.toLowerCase()) {
        case 'upcoming':
        case 'scheduled':
          bg = AppColors.statusUpcomingBg;
          text = AppColors.statusUpcomingText;
          label = 'UPCOMING';
          break;
        case 'completed':
          bg = AppColors.statusCompletedBg;
          text = AppColors.statusCompletedText;
          label = 'COMPLETED';
          break;
        case 'cancelled':
          bg = AppColors.statusCancelledBg;
          text = AppColors.statusCancelledText;
          label = 'CANCELLED';
          break;
        case 'pending':
        default:
          bg = AppColors.statusPendingBg;
          text = AppColors.statusPendingText;
          label = status.toUpperCase();
          break;
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: text,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
