import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/booking_model.dart';
import '../../data/services/supabase_service.dart';
import '../shared/custom_button.dart';
import '../shared/loading_indicator.dart';

class RefundRequestScreen extends StatefulWidget {
  final String bookingId;

  const RefundRequestScreen({super.key, required this.bookingId});

  @override
  State<RefundRequestScreen> createState() => _RefundRequestScreenState();
}

class _RefundRequestScreenState extends State<RefundRequestScreen> {
  final _reasonController = TextEditingController();
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _submitted = false;
  BookingModel? _booking;

  @override
  void initState() {
    super.initState();
    _loadBooking();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadBooking() async {
    final booking = await SupabaseService.instance.getBookingById(
      widget.bookingId,
    );
    if (mounted) {
      setState(() {
        _booking = booking;
        _isLoading = false;
      });
    }
  }

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) return;
    setState(() => _isSubmitting = true);
    try {
      await SupabaseService.instance.requestRefund(
        bookingId: widget.bookingId,
        reason: reason,
      );
      if (mounted) {
        setState(() {
          _submitted = true;
          _isSubmitting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.statusCancelledText,
            content: Text('Could not submit refund request: $e'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Loading booking...'),
      );
    }

    final booking = _booking;
    if (booking == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Request Refund')),
        body: const Center(child: Text('Booking not found')),
      );
    }

    final isPaid = booking.paymentStatus == 'paid';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Request Refund')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: _submitted
              ? Column(
                  children: [
                    const Icon(
                      LucideIcons.checkCircle2,
                      size: 48,
                      color: AppColors.primary,
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Request submitted',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Your refund request has been sent for review.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Back to Booking',
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!isPaid) ...[
                      const Icon(
                        LucideIcons.circleAlert,
                        size: 38,
                        color: Color(0xFFD97706),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Refunds are only available for paid bookings.',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 20),
                      CustomButton(
                        text: 'Back to Booking',
                        onPressed: () => Navigator.pop(context),
                      ),
                    ] else ...[
                      Text(
                        booking.serviceName,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${Formatters.date(booking.date)} • ${Formatters.currency(booking.price)}',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Reason for refund',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _reasonController,
                        minLines: 5,
                        maxLines: 7,
                        decoration: InputDecoration(
                          hintText: 'Please explain why you are requesting a refund...',
                          filled: true,
                          fillColor: AppColors.background,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: AppColors.border,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      CustomButton(
                        text: 'Submit Request',
                        isLoading: _isSubmitting,
                        onPressed: _submit,
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}
