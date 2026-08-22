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

class BookingWizardScreen extends StatefulWidget {
  final Function(int)? onNavigateTab;

  const BookingWizardScreen({super.key, this.onNavigateTab});

  @override
  State<BookingWizardScreen> createState() => _BookingWizardScreenState();
}

class _BookingWizardScreenState extends State<BookingWizardScreen> {
  int _currentStep = 0;
  bool _isLoadingServices = true;
  bool _isSubmitting = false;

  List<ServiceModel> _services = [];
  ServiceModel? _selectedService;

  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  String _selectedTime = '09:00';
  String _frequency = 'one_off'; // one_off, weekly, fortnightly, monthly

  final _addressController = TextEditingController();
  final _postcodeController = TextEditingController();
  final _notesController = TextEditingController();
  String _selectedCity = 'Cardiff';

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
    final svcs = await SupabaseService.instance.getServices();

    if (user != null) {
      final profile = await SupabaseService.instance.getUserProfile(user.id);
      if (profile != null) {
        if (profile.address != null) _addressController.text = profile.address!;
        if (profile.postcode != null) _postcodeController.text = profile.postcode!;
        if (profile.city != null && AppConfig.serviceCities.contains(profile.city)) {
          _selectedCity = profile.city!;
        }
      }
    }

    if (mounted) {
      setState(() {
        _services = svcs;
        if (_services.isNotEmpty) {
          _selectedService = _services.first;
        }
        _isLoadingServices = false;
      });
    }
  }

  double get _calculatedPrice {
    if (_selectedService == null) return 0.0;
    double base = _selectedService!.price;
    if (_frequency == 'weekly') return base * 0.85; // 15% off
    if (_frequency == 'fortnightly') return base * 0.90; // 10% off
    if (_frequency == 'monthly') return base * 0.95; // 5% off
    return base;
  }

  Future<void> _submitBooking() async {
    if (_addressController.text.trim().isEmpty || _postcodeController.text.trim().isEmpty) {
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
      await SupabaseService.instance.createBooking(
        serviceName: _selectedService!.name,
        serviceType: _selectedService!.id,
        date: formattedDate,
        timeSlot: _selectedTime,
        address: _addressController.text.trim(),
        city: _selectedCity,
        postcode: _postcodeController.text.trim().toUpperCase(),
        price: _calculatedPrice,
        notes: _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
        recurringFreq: _frequency != 'one_off' ? _frequency : null,
      );

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppColors.primarySurface,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.checkCircle2, color: AppColors.primary, size: 24),
                ),
                const SizedBox(width: 12),
                const Text('Booking Confirmed!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              ],
            ),
            content: Text(
              'Your ${_selectedService!.name} has been booked for ${Formatters.date(_selectedDate)} at $_selectedTime.',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
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
      appBar: AppBar(
        title: const Text('Book a Clean'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Step Progress Indicator
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              color: Colors.white,
              child: Row(
                children: [
                  _buildStepIndicator(0, 'Service', LucideIcons.sparkles),
                  _buildStepDivider(0),
                  _buildStepIndicator(1, 'Date & Time', LucideIcons.calendar),
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
                border: Border(top: BorderSide(color: AppColors.borderLight)),
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
                          ? 'Confirm Clean (${Formatters.currency(_calculatedPrice)})'
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
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
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
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final svc = _services[index];
            final isSelected = _selectedService?.id == svc.id;

            return InkWell(
              onTap: () => setState(() => _selectedService = svc),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? AppColors.primary : AppColors.borderLight,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isSelected ? AppColors.primary : Colors.transparent,
                        border: Border.all(
                          color: isSelected ? AppColors.primary : AppColors.border,
                          width: 2,
                        ),
                      ),
                      child: isSelected
                          ? const Icon(LucideIcons.check, size: 14, color: Colors.white)
                          : null,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  svc.name,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              if (svc.popular)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primarySurface,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text(
                                    'POPULAR',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            svc.description,
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            Formatters.currency(svc.price),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: AppColors.primary,
                            ),
                          ),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Choose Schedule & Frequency',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 16),

        // Frequency Selector
        const Text(
          'Frequency & Discounts',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _buildFrequencyChip('one_off', 'One-off', 'Standard'),
            const SizedBox(width: 8),
            _buildFrequencyChip('weekly', 'Weekly', '15% OFF'),
            const SizedBox(width: 8),
            _buildFrequencyChip('fortnightly', 'Fortnightly', '10% OFF'),
            const SizedBox(width: 8),
            _buildFrequencyChip('monthly', 'Monthly', '5% OFF'),
          ],
        ),
        const SizedBox(height: 24),

        // Date Picker
        const Text(
          'Preferred Date',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _selectedDate,
              firstDate: DateTime.now().add(const Duration(days: 1)),
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
                const Icon(LucideIcons.calendar, color: AppColors.primary, size: 20),
                const SizedBox(width: 12),
                Text(
                  Formatters.date(_selectedDate),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const Spacer(),
                const Icon(LucideIcons.chevronDown, size: 16, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Time Slot Picker
        const Text(
          'Arrival Time Slot',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: AppConfig.timeSlots.map((time) {
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
      ],
    );
  }

  Widget _buildFrequencyChip(String key, String label, String tag) {
    final isSelected = _frequency == key;
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
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: isSelected ? AppColors.primary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                tag,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? AppColors.primaryDark : AppColors.textMuted,
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
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
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
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
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
              icon: const Icon(LucideIcons.chevronDown, size: 18, color: AppColors.textMuted),
              items: AppConfig.serviceCities.map((city) {
                return DropdownMenuItem(
                  value: city,
                  child: Text(city, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
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
