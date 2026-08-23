import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/constants/app_colors.dart';

String resolveServiceImageUrl(String serviceId, String? dbImageUrl) {
  const siteUrl = 'https://makemeclean.co.uk';

  if (dbImageUrl != null && dbImageUrl.startsWith('http')) {
    return dbImageUrl;
  }

  final Map<String, String> fallbacks = {
    'standard-cleaning': '/images/service-standard-clean.jpg',
    'regular-cleaning': '/images/service-regular-cleaning.jpg',
    'one-off-cleaning': '/images/service-one-off-cleaning.jpg',
    'deep-cleaning': '/images/service-deep-cleaning.jpg',
    'spring-cleaning': '/images/service-spring-cleaning.jpg',
    'same-day-cleaning': '/images/service-same-day-cleaning.jpg',
    'airbnb-cleaning': '/images/service-airbnb-cleaning.jpg',
    'ironing-service': '/images/service-ironing-service.jpg',
    'cleaning-and-ironing': '/images/service-cleaning-and-ironing.jpg',
    'housekeeping': '/images/service-housekeeping.jpg',
    'office-cleaning': '/images/service-office-cleaning.jpg',
  };

  final normalizedId = serviceId
      .toLowerCase()
      .trim()
      .replaceAll(' ', '-')
      .replaceAll('_', '-');
  if (fallbacks.containsKey(normalizedId)) {
    return '$siteUrl${fallbacks[normalizedId]!}';
  }

  if (dbImageUrl != null && dbImageUrl.isNotEmpty) {
    if (dbImageUrl.startsWith('/')) {
      return '$siteUrl$dbImageUrl';
    }
    return dbImageUrl;
  }

  return '';
}

class ServiceImageWidget extends StatelessWidget {
  final String serviceId;
  final String? imageUrl;
  final double width;
  final double height;
  final BorderRadius? borderRadius;
  final BoxFit fit;

  const ServiceImageWidget({
    super.key,
    required this.serviceId,
    this.imageUrl,
    this.width = double.infinity,
    this.height = 140,
    this.borderRadius,
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveUrl = resolveServiceImageUrl(serviceId, imageUrl);
    final radius = borderRadius ?? BorderRadius.circular(14);

    return ClipRRect(
      borderRadius: radius,
      child: Container(
        width: width,
        height: height,
        color: const Color(0xFFF1F5F9),
        child: effectiveUrl.isEmpty
            ? const _ServiceImagePlaceholder()
            : Image.network(
                effectiveUrl,
                width: width,
                height: height,
                fit: fit,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return Container(
                    color: const Color(0xFFF1F5F9),
                    alignment: Alignment.center,
                    child: const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  );
                },
                errorBuilder: (context, error, stackTrace) {
                  return const _ServiceImagePlaceholder();
                },
              ),
      ),
    );
  }
}

class _ServiceImagePlaceholder extends StatelessWidget {
  const _ServiceImagePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primarySurface,
      alignment: Alignment.center,
      child: const Icon(
        LucideIcons.home,
        color: AppColors.primary,
        size: 28,
      ),
    );
  }
}
