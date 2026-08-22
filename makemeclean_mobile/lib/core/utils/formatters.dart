import 'package:intl/intl.dart';

class Formatters {
  static String currency(num? amount) {
    if (amount == null) return '£0.00';
    final format = NumberFormat.currency(locale: 'en_GB', symbol: '£');
    return format.format(amount);
  }

  static String date(dynamic dateValue) {
    if (dateValue == null) return '';
    try {
      DateTime dt;
      if (dateValue is DateTime) {
        dt = dateValue;
      } else if (dateValue is String) {
        dt = DateTime.parse(dateValue);
      } else {
        return dateValue.toString();
      }
      return DateFormat('EEE, d MMM yyyy').format(dt);
    } catch (_) {
      return dateValue.toString();
    }
  }

  static String shortDate(dynamic dateValue) {
    if (dateValue == null) return '';
    try {
      DateTime dt = dateValue is DateTime ? dateValue : DateTime.parse(dateValue.toString());
      return DateFormat('d MMM').format(dt);
    } catch (_) {
      return dateValue.toString();
    }
  }
}

