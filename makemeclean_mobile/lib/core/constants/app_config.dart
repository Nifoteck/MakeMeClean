class AppConfig {
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
