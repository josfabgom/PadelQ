class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:5041',
  );
  static const String appVersion = "v3.2 MOBILE";
}
