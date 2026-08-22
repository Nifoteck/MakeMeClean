class ShiftModel {
  final String id;
  final String bookingId;
  final String cleanerId;
  final String serviceName;
  final String customerName;
  final String address;
  final String city;
  final String postcode;
  final DateTime scheduledDate;
  final String timeSlot;
  final double payAmount;
  final double estimatedHours;
  final String status; // 'available', 'pending', 'confirmed', 'in_progress', 'completed', 'rejected'
  final String? customerNotes;
  final String? adminNotes;
  final List<String> checklist;
  final List<String> completedChecklist;
  final DateTime? createdAt;

  ShiftModel({
    required this.id,
    required this.bookingId,
    required this.cleanerId,
    required this.serviceName,
    required this.customerName,
    required this.address,
    required this.city,
    required this.postcode,
    required this.scheduledDate,
    required this.timeSlot,
    required this.payAmount,
    required this.estimatedHours,
    required this.status,
    this.customerNotes,
    this.adminNotes,
    this.checklist = const [],
    this.completedChecklist = const [],
    this.createdAt,
  });

  factory ShiftModel.fromJson(Map<String, dynamic> json) {
    return ShiftModel(
      id: json['id']?.toString() ?? '',
      bookingId: json['booking_id']?.toString() ?? '',
      cleanerId: json['cleaner_id']?.toString() ?? '',
      serviceName: json['service_name'] as String? ?? 'General Clean',
      customerName: json['customer_name'] as String? ?? 'Customer',
      address: json['address'] as String? ?? '',
      city: json['city'] as String? ?? 'Cardiff',
      postcode: json['postcode'] as String? ?? '',
      scheduledDate: json['scheduled_date'] != null
          ? DateTime.tryParse(json['scheduled_date'].toString()) ?? DateTime.now()
          : DateTime.now(),
      timeSlot: json['time_slot'] as String? ?? '09:00 AM',
      payAmount: (json['pay_amount'] as num?)?.toDouble() ?? 45.0,
      estimatedHours: (json['estimated_hours'] as num?)?.toDouble() ?? 3.0,
      status: json['status'] as String? ?? 'available',
      customerNotes: json['customer_notes'] as String?,
      adminNotes: json['admin_notes'] as String?,
      checklist: (json['checklist'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [
            'Dust all surfaces & furniture',
            'Vacuum & mop all floor areas',
            'Sanitize kitchen countertops & sink',
            'Scrub & disinfect bathrooms & toilets',
            'Empty all waste bins & replace liners',
          ],
      completedChecklist: (json['completed_checklist'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'booking_id': bookingId,
      'cleaner_id': cleanerId,
      'service_name': serviceName,
      'customer_name': customerName,
      'address': address,
      'city': city,
      'postcode': postcode,
      'scheduled_date': scheduledDate.toIso8601String(),
      'time_slot': timeSlot,
      'pay_amount': payAmount,
      'estimated_hours': estimatedHours,
      'status': status,
      'customer_notes': customerNotes,
      'admin_notes': adminNotes,
      'checklist': checklist,
      'completed_checklist': completedChecklist,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
    };
  }

  ShiftModel copyWith({
    String? status,
    List<String>? completedChecklist,
  }) {
    return ShiftModel(
      id: id,
      bookingId: bookingId,
      cleanerId: cleanerId,
      serviceName: serviceName,
      customerName: customerName,
      address: address,
      city: city,
      postcode: postcode,
      scheduledDate: scheduledDate,
      timeSlot: timeSlot,
      payAmount: payAmount,
      estimatedHours: estimatedHours,
      status: status ?? this.status,
      customerNotes: customerNotes,
      adminNotes: adminNotes,
      checklist: checklist,
      completedChecklist: completedChecklist ?? this.completedChecklist,
      createdAt: createdAt,
    );
  }
}

