class BookingPhotoModel {
  final String id;
  final String storagePath;
  final String uploadedAt;

  BookingPhotoModel({
    required this.id,
    required this.storagePath,
    required this.uploadedAt,
  });

  factory BookingPhotoModel.fromJson(Map<String, dynamic> json) {
    return BookingPhotoModel(
      id: json['id']?.toString() ?? '',
      storagePath: json['storage_path']?.toString() ?? '',
      uploadedAt: json['uploaded_at']?.toString() ?? '',
    );
  }
}
