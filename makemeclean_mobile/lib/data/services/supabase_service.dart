import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_config.dart';
import '../models/booking_model.dart';
import '../models/service_model.dart';
import '../models/profile_model.dart';
import '../models/loyalty_model.dart';

class SupabaseService {
  static final SupabaseService instance = SupabaseService._internal();
  SupabaseService._internal();

  bool _isInitialized = false;
  bool get isInitialized => _isInitialized;

  SupabaseClient get _client => Supabase.instance.client;

  User? get currentUser => _isInitialized ? _client.auth.currentUser : null;
  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  // ─── Dynamic Bootstrapping from Website API ────────────────────────────────
  /// Connects to https://makemeclean.co.uk/api/config to fetch active Supabase credentials
  /// at runtime. Zero credentials are hardcoded in the mobile app binary.
  Future<void> initializeFromWebsite() async {
    final prefs = await SharedPreferences.getInstance();
    String? url = prefs.getString('supabase_url');
    String? key = prefs.getString('supabase_anon_key');

    // 1. Try to fetch the latest config from the website API
    try {
      final response = await http
          .get(Uri.parse(AppConfig.apiConfigEndpoint))
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final fetchedUrl = data['supabaseUrl']?.toString();
        final fetchedKey = data['supabaseAnonKey']?.toString();

        if (fetchedUrl != null &&
            fetchedKey != null &&
            fetchedUrl.isNotEmpty &&
            fetchedKey.isNotEmpty) {
          url = fetchedUrl;
          key = fetchedKey;

          // Cache on device for instant offline launch
          await prefs.setString('supabase_url', url);
          await prefs.setString('supabase_anon_key', key);
        }
      }
    } catch (_) {
      // If offline or network error, fallback to cached credentials from device
    }

    if (url == null || key == null || url.isEmpty || key.isEmpty) {
      throw Exception(
        'Unable to connect to MakeMeClean API at ${AppConfig.apiConfigEndpoint}. Please ensure you are connected to the internet.',
      );
    }

    // 2. Initialize Supabase in memory dynamically
    await Supabase.initialize(
      url: url,
      anonKey: key,
    );

    _isInitialized = true;
  }

  // ─── Authentication ────────────────────────────────────────────────────────
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    final response = await _client.auth.signUp(
      email: email.trim(),
      password: password,
      data: {
        'full_name': fullName.trim(),
        'phone': phone?.trim(),
      },
    );

    if (response.user != null) {
      await _client.from('profiles').upsert({
        'id': response.user!.id,
        'full_name': fullName.trim(),
        'phone': phone?.trim(),
      });
    }

    return response;
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(
      email.trim(),
      redirectTo: 'https://makemeclean.co.uk/forgot-password',
    );
  }

  Future<UserResponse> updatePassword(String newPassword) async {
    return await _client.auth.updateUser(
      UserAttributes(password: newPassword),
    );
  }

  // ─── Role Verification ──────────────────────────────────────────────────────
  Future<bool> checkIsAdmin(String? userId) async {
    if (userId == null) return false;
    try {
      final res = await _client
          .from('admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
      return res != null;
    } catch (_) {
      return false;
    }
  }

  Future<bool> checkIsStaff(String? userId) async {
    if (userId == null) return false;
    try {
      final res = await _client
          .from('staff')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
      return res != null;
    } catch (_) {
      return false;
    }
  }

  // ─── User Profile ──────────────────────────────────────────────────────────
  Future<ProfileModel?> getUserProfile(String userId) async {
    try {
      final res = await _client
          .from('profiles')
          .select()
          .eq('id', userId)
          .maybeSingle();
      if (res == null) return null;
      return ProfileModel.fromJson(res);
    } catch (e) {
      return null;
    }
  }

  Future<void> updateUserProfile(ProfileModel profile) async {
    await _client.from('profiles').upsert(profile.toJson());
  }

  // ─── Services ──────────────────────────────────────────────────────────────
  Future<List<ServiceModel>> getServices() async {
    try {
      final res = await _client
          .from('services')
          .select()
          .eq('active', true)
          .order('sort_order', ascending: true);

      return (res as List)
          .map((item) => ServiceModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (_) {
      // Fallback standard services if table not populated
      return [
        ServiceModel(
          id: 'domestic',
          name: 'Standard Domestic Cleaning',
          description: 'Regular cleaning for bedrooms, bathrooms, kitchen, and living areas.',
          price: 35.0,
          popular: true,
        ),
        ServiceModel(
          id: 'deep-clean',
          name: 'Deep Spring Cleaning',
          description: 'Intensive top-to-bottom clean tackling grime, appliances, and hard-to-reach spots.',
          price: 75.0,
        ),
        ServiceModel(
          id: 'end-of-tenancy',
          name: 'End of Tenancy Cleaning',
          description: 'Deposit-back guarantee clean for moving out of rental properties.',
          price: 120.0,
        ),
        ServiceModel(
          id: 'carpet-clean',
          name: 'Carpet & Upholstery Clean',
          description: 'Hot water extraction deep cleaning for carpets, rugs, and sofas.',
          price: 50.0,
        ),
        ServiceModel(
          id: 'commercial',
          name: 'Commercial & Office Cleaning',
          description: 'Professional workspace hygiene, desks, sanitization, and communal areas.',
          price: 90.0,
        ),
      ];
    }
  }

  // ─── Bookings ──────────────────────────────────────────────────────────────
  Future<List<BookingModel>> getUserBookings(String userId) async {
    final res = await _client
        .from('bookings')
        .select()
        .eq('user_id', userId)
        .order('date', ascending: false);

    return (res as List)
        .map((item) => BookingModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<BookingModel?> getBookingById(String bookingId) async {
    final res = await _client
        .from('bookings')
        .select()
        .eq('id', bookingId)
        .maybeSingle();

    if (res == null) return null;
    return BookingModel.fromJson(res);
  }

  Future<BookingModel> createBooking({
    required String serviceName,
    required String serviceType,
    required String date,
    required String timeSlot,
    required String address,
    required String city,
    required String postcode,
    required double price,
    String? notes,
    String? recurringFreq,
  }) async {
    final userId = currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final insertData = {
      'user_id': userId,
      'service_name': serviceName,
      'service_type': serviceType,
      'date': date,
      'time_slot': timeSlot,
      'address': address,
      'city': city,
      'postcode': postcode,
      'price': price,
      'status': 'upcoming',
      'notes': notes,
      'recurring_freq': recurringFreq,
    };

    final res = await _client.from('bookings').insert(insertData).select().single();
    return BookingModel.fromJson(res);
  }

  Future<void> cancelBooking(String bookingId) async {
    await _client
        .from('bookings')
        .update({'status': 'cancelled'})
        .eq('id', bookingId);
  }

  // ─── Loyalty ───────────────────────────────────────────────────────────────
  Future<UserLoyaltyInfo> getUserLoyalty(String userId) async {
    try {
      final res = await _client
          .from('loyalty_points')
          .select('points')
          .eq('user_id', userId);

      int total = 0;
      for (final row in (res as List)) {
        total += (row['points'] as num?)?.toInt() ?? 0;
      }
      return UserLoyaltyInfo.fromPoints(total);
    } catch (_) {
      return UserLoyaltyInfo.fromPoints(150); // Default welcome points
    }
  }

  // ─── Staff Shifts ──────────────────────────────────────────────────────────
  Future<List<BookingModel>> getStaffAssignedBookings(String staffUserId) async {
    try {
      final res = await _client
          .from('bookings')
          .select()
          .eq('assigned_staff_id', staffUserId)
          .order('date', ascending: true);

      return (res as List)
          .map((item) => BookingModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
