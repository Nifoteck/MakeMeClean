import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/constants/app_config.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final dynamic details;

  ApiException(this.message, {this.statusCode = 400, this.details});

  @override
  String toString() => message;
}

class ApiClient {
  static final ApiClient instance = ApiClient._internal();
  ApiClient._internal();

  String get baseUrl => AppConfig.apiBaseUrl;

  Future<Map<String, String>> _getHeaders() async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      final token = Supabase.instance.client.auth.currentSession?.accessToken;
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    } catch (_) {}

    return headers;
  }

  Uri _buildUri(String path, [Map<String, String>? queryParams]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final fullUrl = '$baseUrl$cleanPath';
    final uri = Uri.parse(fullUrl);
    if (queryParams != null && queryParams.isNotEmpty) {
      return uri.replace(queryParameters: queryParams);
    }
    return uri;
  }

  dynamic _handleResponse(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(response.body);
    } catch (_) {
      body = {'ok': false, 'error': 'Server returned invalid response: ${response.statusCode}'};
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (body is Map<String, dynamic> && body.containsKey('ok')) {
        if (body['ok'] == false) {
          throw ApiException(
            body['error']?.toString() ?? 'Operation failed',
            statusCode: response.statusCode,
            details: body['details'],
          );
        }
        return body.containsKey('data') ? body['data'] : body;
      }
      return body;
    }

    final errorMessage = (body is Map<String, dynamic> && body['error'] != null)
        ? body['error'].toString()
        : 'Request failed with status ${response.statusCode}';

    throw ApiException(
      errorMessage,
      statusCode: response.statusCode,
      details: body is Map<String, dynamic> ? body['details'] : null,
    );
  }

  Future<dynamic> get(String path, {Map<String, String>? queryParams}) async {
    final headers = await _getHeaders();
    final uri = _buildUri(path, queryParams);
    final response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 4));
    return _handleResponse(response);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body, Map<String, String>? queryParams}) async {
    final headers = await _getHeaders();
    final uri = _buildUri(path, queryParams);
    final response = await http
        .post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        )
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body, Map<String, String>? queryParams}) async {
    final headers = await _getHeaders();
    final uri = _buildUri(path, queryParams);
    final response = await http
        .patch(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        )
        .timeout(const Duration(seconds: 4));
    return _handleResponse(response);
  }

  Future<dynamic> delete(String path, {Map<String, String>? queryParams}) async {
    final headers = await _getHeaders();
    final uri = _buildUri(path, queryParams);
    final response = await http.delete(uri, headers: headers).timeout(const Duration(seconds: 4));
    return _handleResponse(response);
  }
}

