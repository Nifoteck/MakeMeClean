import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_config.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/service_model.dart';
import '../../data/services/supabase_service.dart';
import '../shared/custom_button.dart';
import '../shared/custom_text_field.dart';
import '../shared/loading_indicator.dart';
import '../shared/service_image_widget.dart';

class BookingWizardScreen extends StatefulWidget {
  final Function(int)? onNavigateTab;

  const BookingWizardScreen({super.key, this.onNavigateTab});

  @override
  State<BookingWizardScreen> createState() => _BookingWizardScreenState();
}

class _BookingWizardScreenState extends State<BookingWizardScreen> {
  static const double _minDurationHours = 1.5;
  static const double _maxDurationHours = 12.0;
  static const double _durationStepHours = 0.5;

  int _currentStep = 0;
  bool _isLoadingServices = true;
  bool _isSubmitting = false;

  List<ServiceModel> _services = [];
  ServiceModel? _selectedService;

  DateTime _selectedDate = DateTime.now();
  String _selectedTime = '09:00';
  double _durationHours = 2.0;
  String _frequency = 'none'; // none, weekly, fortnightly, monthly
  Map<String, double> _recurringDiscounts = {
    'none': 0,
    'weekly': 0,
    'fortnightly': 0,
    'monthly': 0,
  };

  final _addressController = TextEditingController();
  final _postcodeController = TextEditingController();
  final _notesController = TextEditingController();
  String _selectedCity = 'Cardiff';
  List<String> _cities = AppConfig.serviceCities;

  @override
  void initState() {
    super.initState();
    _loadServicesAndProfile();
  }

  @override
  void dispose() {
    _addressController.dispose();
    _postcodeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadServicesAndProfile() async {
    final user = SupabaseService.instance.currentUser;
    final results = await Future.wait([
      SupabaseService.instance.getServices(),
      SupabaseService.instance.getActiveCities(),
      SupabaseService.instance.getSettings(
        keys: ['discount_weekly', 'discount_fortnightly', 'discount_monthly'],
      ),
    ]);
    final svcs = results[0] as List<ServiceModel>;
    final activeCities = results[1] as List<String>;
    final settings = results[2] as Map<String, String>;

    if (user != null) {
      final profile = await SupabaseService.instance.getUserProfile(user.id);
      if (profile != null) {
        if (profile.address != null) _addressController.text = profile.address!;
        if (profile.postcode != null) {
          _postcodeController.text = profile.postcode!;
        }
        if (profile.city != null && activeCities.contains(profile.city)) {
          _selectedCity = profile.city!;
        }
      }
    }

    if (mounted) {
      setState(() {
        _services = svcs;
        _cities = activeCities;
        if (!_cities.contains(_selectedCity) && _cities.isNotEmpty) {
          _selectedCity = _cities.first;
        }
        if (_services.isNotEmpty) {
          _selectedService = _services.first;
        }
        _recurringDiscounts = {
          'none': 0,
          'weekly': _settingPercent(settings['discount_weekly']),
          'fortnightly': _settingPercent(settings['discount_fortnightly']),
          'monthly': _settingPercent(settings['discount_monthly']),
        };
        _isLoadingServices = false;
      });
    }
  }

  double _settingPercent(String? value) {
    final parsed = double.tryParse(value ?? '') ?? 0;
    return parsed.clamp(0, 100).toDouble();
  }

  double get _serviceDiscountPercent {
    if (_selectedService == null) return 0;
    return _selectedService!.discountPercent.clamp(0, 100).toDouble();
  }

  double get _hourlyPrice {
    if (_selectedService == null) return 0.0;
    final discount = _serviceDiscountPercent;
    return discount > 0
        ? _selectedService!.price * (1 - discount / 100)
        : _selectedService!.price;
  }

  double get _recurringDiscountPercent => _recurringDiscounts[_frequency] ?? 0;

  double get _totalBeforeRecurring => _hourlyPrice * _durationHours;

  double get _calculatedPrice {
    final recurringDiscount = _recurringDiscountPercent;
    if (recurringDiscount <= 0) return _totalBeforeRecurring;
    return _totalBeforeRecurring * (1 - recurringDiscount / 100);
  }

  String _formatDuration(double hours) {
    if (hours == 0.5) return '30 minutes';
    if (hours % 1 == 0) {
      return '${hours.toInt()} ${hours == 1 ? 'hour' : 'hours'}';
    }
    final wholeHours = hours.floor();
    return '$wholeHours ${wholeHours == 1 ? 'hour' : 'hours'} 30 minutes';
  }

  String _calcTimeSlot(String startHour, double durationHours) {
    final parts = startHour.split(':').map(int.parse).toList();
    final startMins = parts[0] * 60 + parts[1];
    final endMins = startMins + (durationHours * 60).round();
    final endH = (endMins ~/ 60).toString().padLeft(2, '0');
    final endM = (endMins % 60).toString().padLeft(2, '0');
    return '$startHour - $endH:$endM';
  }

  String _generateInvoiceNumber() {
    final now = DateTime.now();
    final date = DateFormat('yyyyMMdd').format(now);
    final millis = now.millisecondsSinceEpoch.toString();
    return 'MMC-$date-${millis.substring(millis.length - 5)}';
  }

  Future<void> _submitBooking() async {
    if (_addressController.text.trim().isEmpty ||
        _postcodeController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.statusCancelledText,
          content: Text('Please fill in your complete address and postcode.'),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final formattedDate = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final notes = _notesController.text.trim().isNotEmpty
          ? _notesController.text.trim()
          : null;
      final timeSlot = _calcTimeSlot(_selectedTime, _durationHours);
      await SupabaseService.instance.createBooking(
        serviceName: _selectedService!.name,
        serviceType: _selectedService!.id,
        date: formattedDate,
        timeSlot: timeSlot,
        address: _addressController.text.trim(),
        city: _selectedCity,
        postcode: _postcodeController.text.trim().toUpperCase(),
        price: _calculatedPrice,
        notes: notes,
        invoiceNumber: _generateInvoiceNumber(),
        recurringFreq: _frequency != 'none' ? _frequency : null,
      );

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppColors.primarySurface,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    LucideIcons.checkCircle2,
                    color: AppColors.primary,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Booking Confirmed!',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            content: Text(
              'Your ${_selectedService!.name} has been booked for ${Formatters.date(_selectedDate)} at $timeSlot.',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
            actions: [
              CustomButton(
                text: 'View My Bookings',
                onPressed: () {
                  Navigator.pop(ctx);
                  if (widget.onNavigateTab != null) {
                    widget.onNavigateTab!(2); // Switch to Bookings tab
                  }
                },
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.statusCancelledText,
            content: Text('Failed to book: ${e.toString()}'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingServices) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Loading available services...'),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Book a Clean')),
      body: SafeArea(
        child: _services.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No active services are available right now.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              )
            : Column(
                children: [
                  // Step Progress Indicator
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    color: Colors.white,
                    child: Row(
                      children: [
                        _buildStepIndicator(0, 'Service', LucideIcons.sprayCan),
                        _buildStepDivider(0),
                        _buildStepIndicator(1, 'Details', LucideIcons.calendar),
                        _buildStepDivider(1),
                        _buildStepIndicator(2, 'Address', LucideIcons.mapPin),
                      ],
                    ),
                  ),

                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: _buildCurrentStep(),
                    ),
                  ),

                  // Bottom Navigation Actions
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(
                        top: BorderSide(color: AppColors.borderLight),
                      ),
                    ),
                    child: Row(
                      children: [
                        if (_currentStep > 0) ...[
                          Expanded(
                            flex: 1,
                            child: CustomButton(
                              text: 'Back',
                              isOutlined: true,
                              onPressed: () => setState(() => _currentStep--),
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          flex: 2,
                          child: CustomButton(
                            text: _currentStep == 2
                                ? 'Confirm (${Formatters.currency(_calculatedPrice)})'
                                : 'Continue',
                            isLoading: _isSubmitting,
                            onPressed: () {
                              if (_currentStep < 2) {
                                setState(() => _currentStep++);
                              } else {
                                _submitBooking();
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildStepIndicator(int stepIndex, String title, IconData icon) {
    final isActive = _currentStep >= stepIndex;
    final isCurrent = _currentStep == stepIndex;

    return Expanded(
      child: Column(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: isActive ? AppColors.primary : AppColors.background,
              shape: BoxShape.circle,
              border: Border.all(
                color: isActive ? AppColors.primary : AppColors.border,
                width: 2,
              ),
            ),
            child: Icon(
              icon,
              size: 16,
              color: isActive ? Colors.white : AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500,
              color: isCurrent ? AppColors.primary : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepDivider(int afterStep) {
    final isPassed = _currentStep > afterStep;
    return Container(
      width: 24,
      height: 2,
      color: isPassed ? AppColors.primary : AppColors.border,
      margin: const EdgeInsets.only(bottom: 16),
    );
  }

  Widget _buildCurrentStep() {
    switch (_currentStep) {
      case 0:
        return _buildServiceStep();
      case 1:
        return _buildDateTimeStep();
      case 2:
        return _buildAddressStep();
      default:
        return const SizedBox.shrink();
    }
  }

  // ─── Step 1: Services ──────────────────────────────────────────────────────
  Widget _buildServiceStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select a Cleaning Service',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Choose the service that fits your home or commercial space',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _services.length,
          separatorBuilder: (_, _) => const SizedBox(height: 14),
          itemBuilder: (context, index) {
            final svc = _services[index];
            final isSelected = _selectedService?.id == svc.id;
            final serviceDiscount = svc.discountPercent
                .clamp(0, 100)
                .toDouble();
            final hourlyPrice = serviceDiscount > 0
                ? svc.price * (1 - serviceDiscount / 100)
                : svc.price;

            return InkWell(
              onTap: () => setState(() => _selectedService = svc),
              borderRadius: BorderRadius.circular(18),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.primary
                        : AppColors.borderLight,
                    width: isSelected ? 2.5 : 1,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.12),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : [],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Service Image Header with Badge & Radio
                    Stack(
                      children: [
                        ServiceImageWidget(
                          serviceId: svc.id,
                          imageUrl: svc.imageUrl,
                          height: 130,
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(16),
                          ),
                        ),
                        // Gradient Overlay for text contrast
                        Positioned.fill(
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(16),
                              ),
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.black.withValues(alpha: 0.35),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                        // Selection Indicator
                        Positioned(
                          top: 10,
                          left: 10,
                          child: Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected
                                  ? AppColors.primary
                                  : Colors.black45,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                            child: isSelected
                                ? const Icon(
                                    LucideIcons.check,
                                    size: 14,
                                    color: Colors.white,
                                  )
                                : null,
                          ),
                        ),
                        // Popular or Discount Badge
                        if (svc.popular)
                          Positioned(
                            top: 10,
                            right: 10,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFF16A34A),
                                borderRadius: BorderRadius.circular(12),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Colors.black26,
                                    blurRadius: 4,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Text(
                                'POPULAR',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),

                    // Service Details Body
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  svc.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    Formatters.currency(hourlyPrice),
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  const SizedBox(width: 2),
                                  const Text(
                                    '/hr',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          if (svc.description.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              svc.description,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                                height: 1.3,
                              ),
                            ),
                          ],
                          if (serviceDiscount > 0) ...[
                            const SizedBox(height: 8),
                            Text(
                              '${serviceDiscount.toStringAsFixed(0)}% off ${Formatters.currency(svc.price)}/hr',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  // ─── Step 2: Date, Time & Frequency ─────────────────────────────────────────
  Widget _buildDateTimeStep() {
    final today = DateTime.now();
    final selectedDateOnly = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
    );
    final todayOnly = DateTime(today.year, today.month, today.day);
    final availableTimes = selectedDateOnly == todayOnly
        ? AppConfig.timeSlots
              .where(
                (time) => DateTime.parse(
                  '${DateFormat('yyyy-MM-dd').format(_selectedDate)}T$time:00',
                ).isAfter(today),
              )
              .toList()
        : AppConfig.timeSlots;

    if (availableTimes.isNotEmpty && !availableTimes.contains(_selectedTime)) {
      _selectedTime = availableTimes.first;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Choose Booking Details',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 16),

        const Text(
          'Number of Hours',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: _durationHours <= _minDurationHours
                    ? null
                    : () =>
                          setState(() => _durationHours -= _durationStepHours),
                icon: const Icon(LucideIcons.minus),
              ),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      _formatDuration(_durationHours),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${Formatters.currency(_hourlyPrice)}/hr',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _durationHours >= _maxDurationHours
                    ? null
                    : () =>
                          setState(() => _durationHours += _durationStepHours),
                icon: const Icon(LucideIcons.plus),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        const Text(
          'Preferred Date',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _selectedDate,
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 90)),
            );
            if (picked != null) setState(() => _selectedDate = picked);
          },
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(
                  LucideIcons.calendar,
                  color: AppColors.primary,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Text(
                  Formatters.date(_selectedDate),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const Spacer(),
                const Icon(
                  LucideIcons.chevronDown,
                  size: 16,
                  color: AppColors.textMuted,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        const Text(
          'Start Time',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        if (availableTimes.isEmpty)
          const Text(
            'No more start times are available today. Please choose another date.',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.statusCancelledText,
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: availableTimes.map((time) {
              final isSelected = _selectedTime == time;
              return ChoiceChip(
                label: Text(time),
                selected: isSelected,
                onSelected: (_) => setState(() => _selectedTime = time),
                selectedColor: AppColors.primary,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
                backgroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(
                    color: isSelected ? AppColors.primary : AppColors.border,
                  ),
                ),
              );
            }).toList(),
          ),
        const SizedBox(height: 24),

        const Text(
          'Booking Schedule',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _buildFrequencyChip('none', 'One-off'),
            const SizedBox(width: 8),
            _buildFrequencyChip('monthly', 'Monthly'),
            const SizedBox(width: 8),
            _buildFrequencyChip('fortnightly', 'Fortnightly'),
            const SizedBox(width: 8),
            _buildFrequencyChip('weekly', 'Weekly'),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.primarySurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Text(
            '${_calcTimeSlot(_selectedTime, _durationHours)} • ${Formatters.currency(_calculatedPrice)}',
            style: const TextStyle(
              color: AppColors.primaryDark,
              fontWeight: FontWeight.w900,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFrequencyChip(String key, String label) {
    final isSelected = _frequency == key;
    final discount = _recurringDiscounts[key] ?? 0;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _frequency = key),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primarySurface : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Column(
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: isSelected ? AppColors.primary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                discount > 0 ? '-${discount.toStringAsFixed(0)}%' : 'Standard',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: isSelected
                      ? AppColors.primaryDark
                      : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Step 3: Address & Notes ────────────────────────────────────────────────
  Widget _buildAddressStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Location & Instructions',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 16),

        CustomTextField(
          label: 'Street Address',
          hint: '12 High Street, Flat 4',
          controller: _addressController,
          prefixIcon: LucideIcons.home,
        ),
        const SizedBox(height: 16),

        // City Dropdown
        const Text(
          'City / Town',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedCity,
              isExpanded: true,
              icon: const Icon(
                LucideIcons.chevronDown,
                size: 18,
                color: AppColors.textMuted,
              ),
              items: _cities.map((city) {
                return DropdownMenuItem(
                  value: city,
                  child: Text(
                    city,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedCity = val);
              },
            ),
          ),
        ),
        const SizedBox(height: 16),

        CustomTextField(
          label: 'Postcode',
          hint: 'CF10 1AA',
          controller: _postcodeController,
          prefixIcon: LucideIcons.mapPin,
        ),
        const SizedBox(height: 16),

        CustomTextField(
          label: 'Special Instructions / Access Notes (Optional)',
          hint: 'Key safe code, parking info, pets on property...',
          controller: _notesController,
          maxLines: 3,
        ),
      ],
    );
  }
}
