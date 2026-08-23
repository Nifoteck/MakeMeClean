class RescheduleRequestModel {
  final String id;
  final String requestedDate;
  final String requestedTime;
  final String status;
  final String? reason;

  RescheduleRequestModel({
    required this.id,
    required this.requestedDate,
    required this.requestedTime,
    required this.status,
    this.reason,
  });

  factory RescheduleRequestModel.fromJson(Map<String, dynamic> json) {
    return RescheduleRequestModel(
      id: json['id']?.toString() ?? '',
      requestedDate: json['requested_date']?.toString() ?? '',
      requestedTime: json['requested_time']?.toString() ?? '',
      status: json['status']?.toString() ?? 'pending',
      reason: json['reason']?.toString(),
    );
  }
}
