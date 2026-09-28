import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}

class ErpApi {
  ErpApi({http.Client? client}) : _client = client ?? http.Client();

  static const _baseUrl = 'https://yousef-beryl.vercel.app';
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'erp_mobile_session';
  final http.Client _client;

  Future<bool> get hasSession async => (await _storage.read(key: _tokenKey)) != null;

  Future<dynamic> get(String path) => _request('GET', path);

  Future<dynamic> post(String path, Map<String, dynamic> body) =>
      _request('POST', path, body: body);

  Future<void> login(String email, String password) async {
    final result = await post('/api/mobile/auth/login', {
      'email': email.trim(),
      'password': password,
    }) as Map<String, dynamic>;
    final data = result['data'] as Map<String, dynamic>;
    await _storage.write(key: _tokenKey, value: data['token'] as String);
  }

  Future<void> logout() async {
    try {
      await post('/api/mobile/auth/logout', {});
    } finally {
      await _storage.delete(key: _tokenKey);
    }
  }

  Future<dynamic> _request(String method, String path,
      {Map<String, dynamic>? body}) async {
    final token = await _storage.read(key: _tokenKey);
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
    final uri = Uri.parse('$_baseUrl$path');
    final response = method == 'POST'
        ? await _client.post(uri, headers: headers, body: jsonEncode(body))
        : await _client.get(uri, headers: headers);
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode >= 400) {
      if (response.statusCode == 401 && token != null) {
        await _storage.delete(key: _tokenKey);
      }
      throw ApiException(
          decoded is Map ? (decoded['error']?.toString() ?? 'حدث خطأ') : 'حدث خطأ',
          response.statusCode);
    }
    return decoded;
  }
}
