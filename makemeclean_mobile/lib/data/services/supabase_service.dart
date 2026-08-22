import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_config.dart';
import '../models/booking_model.dart';
import '../models/service_model.dart';
import '../models/profile_model.dart';
import '../models/loyalty_model.dart';
import '../models/shift_model.dart';
import '../models/notification_model.dart';

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

  // ─── Active Service Cities ────────────────────────────────────────────────
  Future<List<String>> getActiveCities() async {
    try {
      final res = await _client
          .from('service_cities')
          .select('name')
          .eq('is_active', true)
          .order('name', ascending: true);

      if ((res as List).isNotEmpty) {
        return (res).map((item) => item['name'] as String).toList();
      }
    } catch (_) {}

    return [
      'Cardiff',
      'Newport',
      'Swansea',
      'Bridgend',
      'Barry',
      'Penarth',
      'Caerphilly',
      'Cwmbran',
      'Pontypridd',
      'Llanelli',
      'Neath',
      'Merthyr Tydfil',
      'Rhondda',
      'Port Talbot',
      'Pontypool',
      'Aberdare',
      'Abergavenny',
    ];
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

  // ─── UK Staff Shift Marketplace & Roster ──────────────────────────────────
  Future<List<ShiftModel>> getOpenShifts() async {
    try {
      final res = await _client
          .from('shifts')
          .select()
          .eq('status', 'available')
          .order('scheduled_date', ascending: true);

      if ((res as List).isNotEmpty) {
        return res
            .map((item) => ShiftModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}

    // Fallback: derive available shifts from unassigned upcoming customer bookings
    try {
      final bookings = await _client
          .from('bookings')
          .select()
          .isFilter('assigned_staff_id', null)
          .neq('status', 'cancelled')
          .order('date', ascending: true);

      return (bookings as List).map((b) {
        final bMap = b as Map<String, dynamic>;
        final duration = (bMap['duration_hours'] as num?)?.toDouble() ?? 3.0;
        final total = (bMap['total_price'] as num?)?.toDouble() ?? 45.0;
        return ShiftModel(
          id: 'shift_${bMap['id']}',
          bookingId: bMap['id'].toString(),
          cleanerId: '',
          serviceName: bMap['service_title'] as String? ?? 'General Cleaning',
          customerName: bMap['customer_name'] as String? ?? 'Client',
          address: bMap['address'] as String? ?? '',
          city: bMap['city'] as String? ?? 'Cardiff',
          postcode: bMap['postcode'] as String? ?? '',
          scheduledDate: bMap['date'] != null
              ? DateTime.tryParse(bMap['date'].toString()) ?? DateTime.now()
              : DateTime.now(),
          timeSlot: bMap['time_slot'] as String? ?? '09:00 AM',
          payAmount: total * 0.70, // 70% cleaner split
          estimatedHours: duration,
          status: 'available',
          customerNotes: bMap['notes'] as String?,
        );
      }).toList();
    } catch (_) {
      // Return realistic mock slots if database has no active bookings yet
      final now = DateTime.now();
      return [
        ShiftModel(
          id: 'shift_demo_1',
          bookingId: 'book_101',
          cleanerId: '',
          serviceName: 'Deep Clean & Sanitization',
          customerName: 'Sarah Jenkins',
          address: '42 Newport Road',
          city: 'Cardiff',
          postcode: 'CF24 0AB',
          scheduledDate: now.add(const Duration(days: 1)),
          timeSlot: '09:00 AM - 12:30 PM',
          payAmount: 52.50,
          estimatedHours: 3.5,
          status: 'available',
          customerNotes: 'Key is in the lockbox by the front door. Code: 4921',
        ),
        ShiftModel(
          id: 'shift_demo_2',
          bookingId: 'book_102',
          cleanerId: '',
          serviceName: 'End of Tenancy Full Clean',
          customerName: 'David Evans',
          address: '15 Marina Mews',
          city: 'Swansea',
          postcode: 'SA1 1WG',
          scheduledDate: now.add(const Duration(days: 2)),
          timeSlot: '01:00 PM - 05:00 PM',
          payAmount: 68.00,
          estimatedHours: 4.0,
          status: 'available',
          customerNotes: 'Empty flat. Oven clean and interior windows included.',
        ),
        ShiftModel(
          id: 'shift_demo_3',
          bookingId: 'book_103',
          cleanerId: '',
          serviceName: 'Regular Domestic Maintenance',
          customerName: 'Elinor Williams',
          address: '88 Cathedral Road',
          city: 'Cardiff',
          postcode: 'CF11 9LN',
          scheduledDate: now.add(const Duration(days: 3)),
          timeSlot: '10:00 AM - 01:00 PM',
          payAmount: 45.00,
          estimatedHours: 3.0,
          status: 'available',
          customerNotes: 'Friendly Golden Retriever will be in the garden.',
        ),
      ];
    }
  }

  Future<void> claimShift(ShiftModel shift, {String? notes}) async {
    final userId = currentUser?.id ?? 'temp_cleaner';
    try {
      await _client.from('shift_applications').insert({
        'shift_id': shift.id,
        'booking_id': shift.bookingId,
        'cleaner_id': userId,
        'status': 'pending',
        'cleaner_notes': notes,
        'created_at': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
  }

  Future<List<ShiftModel>> getCleanerRoster(String cleanerId) async {
    try {
      final res = await _client
          .from('shift_applications')
          .select()
          .eq('cleaner_id', cleanerId)
          .order('created_at', ascending: false);

      if ((res as List).isNotEmpty) {
        return res
            .map((item) => ShiftModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}

    // Return active demo roster
    final now = DateTime.now();
    return [
      ShiftModel(
        id: 'roster_1',
        bookingId: 'book_001',
        cleanerId: cleanerId,
        serviceName: 'Domestic Weekly Clean',
        customerName: 'James Davies',
        address: '12 Conway Road, Pontcanna',
        city: 'Cardiff',
        postcode: 'CF11 9NT',
        scheduledDate: now.add(const Duration(hours: 18)),
        timeSlot: '09:00 AM - 12:00 PM',
        payAmount: 48.00,
        estimatedHours: 3.0,
        status: 'confirmed',
        customerNotes: 'Alarm code 1234. All cleaning supplies under sink.',
      ),
      ShiftModel(
        id: 'roster_2',
        bookingId: 'book_002',
        cleanerId: cleanerId,
        serviceName: 'Deep Kitchen & Bathroom Clean',
        customerName: 'Megan Roberts',
        address: '29 High Street',
        city: 'Newport',
        postcode: 'NP20 1FX',
        scheduledDate: now.add(const Duration(days: 2)),
        timeSlot: '02:00 PM - 05:00 PM',
        payAmount: 50.00,
        estimatedHours: 3.0,
        status: 'pending',
        customerNotes: 'Awaiting admin slot confirmation.',
      ),
    ];
  }

  Future<void> updateShiftStatus(String shiftId, String status) async {
    try {
      await _client
          .from('shift_applications')
          .update({'status': status})
          .eq('id', shiftId);
    } catch (_) {}
  }

  Future<void> updateShiftChecklist(
      String shiftId, List<String> completed) async {
    try {
      await _client
          .from('shift_applications')
          .update({'completed_checklist': completed})
          .eq('id', shiftId);
    } catch (_) {}
  }

  // ─── In-App Notifications Center ───────────────────────────────────────────
  Future<List<NotificationModel>> getNotifications(String userId) async {
    try {
      final res = await _client
          .from('notifications')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      return (res as List)
          .map((item) => NotificationModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (_) {
      final now = DateTime.now();
      return [
        NotificationModel(
          id: 'notif_1',
          userId: userId,
          title: 'Shift Confirmed ✅',
          message: 'Your Pontcanna domestic clean for tomorrow is confirmed.',
          type: 'shift_approved',
          isRead: false,
          createdAt: now.subtract(const Duration(minutes: 45)),
        ),
        NotificationModel(
          id: 'notif_2',
          userId: userId,
          title: 'New Shifts Available in Cardiff',
          message: '3 new open cleaning slots were just posted for this week.',
          type: 'system',
          isRead: false,
          createdAt: now.subtract(const Duration(hours: 3)),
        ),
        NotificationModel(
          id: 'notif_3',
          userId: userId,
          title: 'Welcome to MakeMeClean',
          message: 'Your account is verified and ready for bookings and shifts.',
          type: 'system',
          isRead: true,
          createdAt: now.subtract(const Duration(days: 1)),
        ),
      ];
    }
  }

  Future<void> markNotificationRead(String notificationId) async {
    try {
      await _client
          .from('notifications')
          .update({'is_read': true})
          .eq('id', notificationId);
    } catch (_) {}
  }

  // ─── Real Admin Supabase Operations (Zero Mock Data) ─────────────────────────
  
  // 1. Bookings
  Future<List<Map<String, dynamic>>> adminGetBookings() async {
    try {
      final res = await _client
          .from('bookings')
          .select('*, profiles(full_name, phone, email)')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminUpdateBookingStatus(String id, String status) async {
    try {
      await _client.from('bookings').update({'status': status}).eq('id', id);
    } catch (_) {}
  }

  Future<void> adminAssignStaffToBooking(String bookingId, String staffId) async {
    try {
      await _client.from('booking_assignments').upsert({
        'booking_id': bookingId,
        'staff_id': staffId,
      });
      await _client.from('bookings').update({'assigned_staff_id': staffId}).eq('id', bookingId);
    } catch (_) {}
  }

  // 2. Applicants
  Future<List<Map<String, dynamic>>> adminGetApplicants() async {
    try {
      final res = await _client
          .from('job_applications')
          .select('*')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminUpdateApplicantStatus(String id, String status) async {
    try {
      await _client.from('job_applications').update({'status': status}).eq('id', id);
    } catch (_) {}
  }

  // 3. Staff
  Future<List<Map<String, dynamic>>> adminGetStaff() async {
    try {
      final res = await _client
          .from('staff')
          .select('*')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminToggleStaffActive(String staffId, bool currentActive) async {
    try {
      await _client.from('staff').update({'active': !currentActive}).eq('id', staffId);
    } catch (_) {}
  }

  // 4. Services
  Future<List<Map<String, dynamic>>> adminGetServices() async {
    try {
      final res = await _client
          .from('services')
          .select('*')
          .order('name', ascending: true);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminUpsertService(Map<String, dynamic> data) async {
    try {
      await _client.from('services').upsert(data);
    } catch (_) {}
  }

  Future<void> adminToggleServiceActive(String id, bool currentActive) async {
    try {
      await _client.from('services').update({'active': !currentActive}).eq('id', id);
    } catch (_) {}
  }

  // 5. Payroll
  Future<List<Map<String, dynamic>>> adminGetPayrollRuns() async {
    try {
      final res = await _client
          .from('payroll_runs')
          .select('*, staff(first_name, last_name, email)')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  // 6. Reschedules
  Future<List<Map<String, dynamic>>> adminGetReschedules() async {
    try {
      final res = await _client
          .from('reschedule_requests')
          .select('*, bookings(*)')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminUpdateRescheduleStatus(String id, String status) async {
    try {
      await _client.from('reschedule_requests').update({'status': status}).eq('id', id);
    } catch (_) {}
  }

  // 7. Plans (Subscriptions)
  Future<List<Map<String, dynamic>>> adminGetPlans() async {
    try {
      final res = await _client
          .from('recurring_plans')
          .select('*, profiles(full_name, email)')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  // 8. Contact Messages
  Future<List<Map<String, dynamic>>> adminGetMessages() async {
    try {
      final res = await _client
          .from('contact_messages')
          .select('*')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminMarkMessageRead(String id, bool isRead) async {
    try {
      await _client.from('contact_messages').update({'is_read': isRead}).eq('id', id);
    } catch (_) {}
  }

  // 9. Refunds
  Future<List<Map<String, dynamic>>> adminGetRefunds() async {
    try {
      final res = await _client
          .from('refund_requests')
          .select('*, bookings(*)')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminUpdateRefundStatus(String id, String status) async {
    try {
      await _client.from('refund_requests').update({'status': status}).eq('id', id);
    } catch (_) {}
  }

  // 10. Photos
  Future<List<Map<String, dynamic>>> adminGetCleanPhotos() async {
    try {
      final res = await _client
          .from('clean_photos')
          .select('*, bookings(*)')
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  // 11. Loyalty
  Future<List<Map<String, dynamic>>> adminGetLoyaltyRecords() async {
    try {
      final res = await _client
          .from('profiles')
          .select('id, full_name, email, loyalty_points, tier')
          .order('loyalty_points', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminAdjustLoyaltyPoints(String userId, int points) async {
    try {
      await _client.from('profiles').update({'loyalty_points': points}).eq('id', userId);
    } catch (_) {}
  }

  // 12. Settings & Service Cities
  Future<Map<String, String>> adminGetSettings() async {
    try {
      final res = await _client.from('settings').select('key, value');
      final map = <String, String>{};
      for (final r in (res as List)) {
        map[r['key']?.toString() ?? ''] = r['value']?.toString() ?? '';
      }
      return map;
    } catch (_) {
      return {};
    }
  }

  Future<void> adminSaveSetting(String key, String value) async {
    try {
      await _client.from('settings').upsert({'key': key, 'value': value});
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> adminGetAllCities() async {
    try {
      final res = await _client
          .from('service_cities')
          .select()
          .order('name', ascending: true);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (_) {
      return [];
    }
  }

  Future<void> adminToggleCity(String cityId, bool currentActive) async {
    try {
      await _client
          .from('service_cities')
          .update({'is_active': !currentActive})
          .eq('id', cityId);
    } catch (_) {}
  }

  Future<void> adminAddCity(String name, String region) async {
    try {
      await _client
          .from('service_cities')
          .insert({'name': name.trim(), 'region': region, 'is_active': true});
    } catch (_) {}
  }
}

