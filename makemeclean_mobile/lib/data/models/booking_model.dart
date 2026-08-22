class BookingModel {
  final String id;
  final String serviceName;
  final String serviceType;
  final String date;
  final String timeSlot;
  final String? address;
  final String city;
  final String? postcode;
  final String status;
  final String? paymentStatus;
  final double price;
  final String? notes;
  final String? invoiceNumber;
  final String createdAt;
  final String? userId;
  final String? recurringFreq;

  BookingModel({
    required this.id,
    required this.serviceName,
    required this.serviceType,
    required this.date,
    required this.timeSlot,
    this.address,
    required this.city,
    this.postcode,
    required this.status,
    this.paymentStatus,
    required this.price,
    this.notes,
    this.invoiceNumber,
    required this.createdAt,
    this.userId,
    this.recurringFreq,
  });

  factory BookingModel.fromJson(Map<String, dynamic> json) {
    return BookingModel(
      id: json['id']?.toString() ?? '',
      serviceName: json['service_name']?.toString() ?? 'Cleaning Service',
      serviceType: json['service_type']?.toString() ?? 'standard',
      date: json['date']?.toString() ?? '',
      timeSlot: json['time_slot']?.toString() ?? '',
      address: json['address']?.toString(),
      city: json['city']?.toString() ?? 'Wales',
      postcode: json['postcode']?.toString(),
      status: json['status']?.toString() ?? 'upcoming',
      paymentStatus: json['payment_status']?.toString(),
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      notes: json['notes']?.toString(),
      invoiceNumber: json['invoice_number']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
      userId: json['user_id']?.toString(),
      recurringFreq: json['recurring_freq']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'service_name': serviceName,
      'service_type': serviceType,
      'date': date,
      'time_slot': timeSlot,
      'address': address,
      'city': city,
      'postcode': postcode,
      'status': status,
      'payment_status': paymentStatus,
      'price': price,
      'notes': notes,
      'invoice_number': invoiceNumber,
      'created_at': createdAt,
      'user_id': userId,
      'recurring_freq': recurringFreq,
    };
  }
}

