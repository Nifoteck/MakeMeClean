class ProfileModel {
  final String id;
  final String? fullName;
  final String? phone;
  final String? address;
  final String? city;
  final String? postcode;
  final String? createdAt;

  ProfileModel({
    required this.id,
    this.fullName,
    this.phone,
    this.address,
    this.city,
    this.postcode,
    this.createdAt,
  });

  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    return ProfileModel(
      id: json['id']?.toString() ?? '',
      fullName: json['full_name']?.toString(),
      phone: json['phone']?.toString(),
      address: json['address']?.toString(),
      city: json['city']?.toString(),
      postcode: json['postcode']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'full_name': fullName,
      'phone': phone,
      'address': address,
      'city': city,
      'postcode': postcode,
    };
  }
}

