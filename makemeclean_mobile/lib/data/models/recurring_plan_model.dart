class RecurringPlanModel {
  final String id;
  final String serviceName;
  final String serviceType;
  final String frequency;
  final String startTime;
  final double durationHours;
  final String address;
  final String city;
  final String postcode;
  final double pricePerVisit;
  final double discountPercent;
  final String? notes;
  final String status;
  final String createdAt;

  RecurringPlanModel({
    required this.id,
    required this.serviceName,
    required this.serviceType,
    required this.frequency,
    required this.startTime,
    required this.durationHours,
    required this.address,
    required this.city,
    required this.postcode,
    required this.pricePerVisit,
    required this.discountPercent,
    this.notes,
    required this.status,
    required this.createdAt,
  });

  factory RecurringPlanModel.fromJson(Map<String, dynamic> json) {
    return RecurringPlanModel(
      id: json['id']?.toString() ?? '',
      serviceName: json['service_name']?.toString() ?? '',
      serviceType: json['service_type']?.toString() ?? '',
      frequency: json['frequency']?.toString() ?? '',
      startTime: json['start_time']?.toString() ?? '',
      durationHours: (json['duration_hours'] as num?)?.toDouble() ?? 0,
      address: json['address']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      postcode: json['postcode']?.toString() ?? '',
      pricePerVisit: (json['price_per_visit'] as num?)?.toDouble() ?? 0,
      discountPercent: (json['discount_percent'] as num?)?.toDouble() ?? 0,
      notes: json['notes']?.toString(),
      status: json['status']?.toString() ?? 'active',
      createdAt: json['created_at']?.toString() ?? '',
    );
  }
}
