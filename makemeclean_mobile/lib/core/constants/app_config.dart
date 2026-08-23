class AppConfig {
  // Supabase Backend Credentials
  static const String supabaseUrl = 'https://dlbpldhtrwzyzhumhptx.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsYnBsZGh0cnd6eXpodW1ocHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODc3MjksImV4cCI6MjA5MzI2MzcyOX0.2a6H2nipKseGDhf295Kzwtjrs5exrTM9DIkIMINYCaA';

  // Website Base URL & Bootstrapping API
  static const String siteUrl = 'https://makemeclean.co.uk';
  static const String apiBaseUrl = '$siteUrl/api';
  static const String apiConfigEndpoint = '$apiBaseUrl/config';
  static const String contactEmail = 'contact@makemeclean.co.uk';

  // Standard Operating Hours (7am - 5pm)
  static const List<String> timeSlots = [
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
  ];

  // Wales Service Areas
  static const List<String> serviceCities = [
    'Cardiff',
    'Swansea',
    'Newport',
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
