class ServiceModel {
  final String id;
  final String name;
  final String description;
  final double price;
  final String? imageUrl;
  final double discountPercent;
  final bool popular;

  ServiceModel({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    this.imageUrl,
    this.discountPercent = 0.0,
    this.popular = false,
  });

  factory ServiceModel.fromJson(Map<String, dynamic> json) {
    return ServiceModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      imageUrl: json['image_url']?.toString(),
      discountPercent: (json['discount_percent'] as num?)?.toDouble() ?? 0.0,
      popular: json['popular'] == true,
    );
  }
}

