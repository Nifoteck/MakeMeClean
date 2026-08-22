import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;

    switch (status.toLowerCase()) {
      case 'upcoming':
      case 'scheduled':
        bg = AppColors.statusUpcomingBg;
        text = AppColors.statusUpcomingText;
        break;
      case 'completed':
        bg = AppColors.statusCompletedBg;
        text = AppColors.statusCompletedText;
        break;
      case 'cancelled':
        bg = AppColors.statusCancelledBg;
        text = AppColors.statusCancelledText;
        break;
      case 'pending':
      default:
        bg = AppColors.statusPendingBg;
        text = AppColors.statusPendingText;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.toUpperCase(),
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

