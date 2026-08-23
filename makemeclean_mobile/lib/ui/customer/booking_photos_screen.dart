import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/constants/app_colors.dart';
import '../../data/models/booking_photo_model.dart';
import '../../data/services/supabase_service.dart';
import '../shared/custom_button.dart';
import '../shared/loading_indicator.dart';

class BookingPhotosScreen extends StatefulWidget {
  final String bookingId;

  const BookingPhotosScreen({super.key, required this.bookingId});

  @override
  State<BookingPhotosScreen> createState() => _BookingPhotosScreenState();
}

class _BookingPhotosScreenState extends State<BookingPhotosScreen> {
  final _picker = ImagePicker();
  bool _isLoading = true;
  bool _isUploading = false;
  String? _deletingId;
  List<BookingPhotoModel> _photos = [];

  @override
  void initState() {
    super.initState();
    _loadPhotos();
  }

  Future<void> _loadPhotos() async {
    setState(() => _isLoading = true);
    try {
      final photos = await SupabaseService.instance.getBookingPhotos(
        widget.bookingId,
      );
      if (mounted) {
        setState(() {
          _photos = photos;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickAndUpload() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1800,
      imageQuality: 85,
    );
    if (file == null) return;

    final bytes = await file.readAsBytes();
    if (bytes.length > 5 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image must be under 5MB.')),
        );
      }
      return;
    }

    setState(() => _isUploading = true);
    try {
      final ext = file.name.contains('.') ? file.name.split('.').last : 'jpg';
      await SupabaseService.instance.uploadBookingPhoto(
        bookingId: widget.bookingId,
        bytes: bytes,
        fileExtension: ext,
        contentType: file.mimeType,
      );
      await _loadPhotos();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.statusCancelledText,
            content: Text('Upload failed: $e'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _deletePhoto(BookingPhotoModel photo) async {
    setState(() => _deletingId = photo.id);
    try {
      await SupabaseService.instance.deleteBookingPhoto(
        photo.id,
        photo.storagePath,
      );
      await _loadPhotos();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.statusCancelledText,
            content: Text('Delete failed: $e'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Loading photos...'),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Booking Photos')),
      body: RefreshIndicator(
        onRefresh: _loadPhotos,
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.borderLight),
              ),
              child: Column(
                children: [
                  const Icon(
                    LucideIcons.imagePlus,
                    size: 40,
                    color: AppColors.primary,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Share photos from this clean',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Upload JPG, PNG, or WebP images up to 5MB.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 18),
                  CustomButton(
                    text: 'Upload Photo',
                    isLoading: _isUploading,
                    icon: const Icon(LucideIcons.upload, size: 18),
                    onPressed: _pickAndUpload,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            if (_photos.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(
                  child: Text(
                    'No photos uploaded yet.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _photos.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemBuilder: (context, index) {
                  final photo = _photos[index];
                  final url = SupabaseService.instance.getBookingPhotoUrl(
                    photo.storagePath,
                  );
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.network(url, fit: BoxFit.cover),
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Material(
                            color: Colors.black.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(999),
                            child: IconButton(
                              icon: _deletingId == photo.id
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(
                                      LucideIcons.trash2,
                                      color: Colors.white,
                                      size: 18,
                                    ),
                              onPressed: _deletingId == null
                                  ? () => _deletePhoto(photo)
                                  : null,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
