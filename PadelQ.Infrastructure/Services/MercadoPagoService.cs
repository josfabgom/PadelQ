using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Infrastructure.Persistence;
using PadelQ.Domain.Entities;
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Services
{
    public class MercadoPagoService : IMercadoPagoService
    {
        private readonly ApplicationDbContext _context;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        public MercadoPagoService(ApplicationDbContext context, HttpClient httpClient, IConfiguration configuration)
        {
            _context = context;
            _httpClient = httpClient;
            _configuration = configuration;
        }

        private async Task<string> GetAccessTokenAsync()
        {
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_AccessToken");
            var expirySetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_TokenExpiry");
            
            if (expirySetting != null && DateTime.TryParse(expirySetting.Value, out DateTime expiryDate))
            {
                if (DateTime.UtcNow >= expiryDate.AddDays(-1)) // Si expira en menos de 1 día, refrescamos automáticamente
                {
                    try
                    {
                        bool refreshed = await RefreshTokenAsync();
                        if (refreshed)
                        {
                            setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_AccessToken");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error auto-refreshing Mercado Pago token: {ex.Message}");
                    }
                }
            }

            return setting?.Value ?? _configuration["MercadoPago:AccessToken"];
        }

        public async Task<string> CreateQrOrderAsync(int terminalId, decimal amount, string description, string referenceId)
        {
            var terminal = await _context.PointTerminals.FindAsync(terminalId);
            if (terminal == null) throw new Exception("Terminal not found");

            var accessToken = await GetAccessTokenAsync();
            if (string.IsNullOrEmpty(accessToken)) throw new Exception("Mercado Pago Access Token not configured.");

            // Extract user ID from token
            var parts = accessToken.Split('-');
            if (parts.Length < 4) throw new Exception("Invalid Access Token format");
            var userId = parts[parts.Length - 1];

            var url = $"https://api.mercadopago.com/instore/orders/qr/seller/collectors/{userId}/pos/{terminal.ExternalPosId}/qrs";

            var payload = new
            {
                external_reference = referenceId,
                title = description,
                description = description,
                total_amount = amount,
                items = new[]
                {
                    new
                    {
                        title = description,
                        unit_price = amount,
                        quantity = 1,
                        unit_measure = "unit",
                        total_amount = amount
                    }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Put, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"Error creating MP QR order: {error}");
            }

            var content = await response.Content.ReadAsStringAsync();
            try
            {
                using var doc = JsonDocument.Parse(content);
                if (doc.RootElement.TryGetProperty("qr_data", out var qrDataProp))
                {
                    return qrDataProp.GetString() ?? "OK";
                }
            }
            catch
            {
                // Fallback en caso de error de análisis
            }

            return "OK";
        }

        public async Task<dynamic> GetPaymentAsync(string paymentId)
        {
            var accessToken = await GetAccessTokenAsync();
            var url = $"https://api.mercadopago.com/v1/payments/{paymentId}";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;

            var content = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<dynamic>(content);
        }

        public async Task<string> GetOAuthUrlAsync(string state, string redirectUri)
        {
            var clientIdSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_ClientId");
            var clientId = clientIdSetting?.Value ?? _configuration["MercadoPago:ClientId"];
            
            if (string.IsNullOrEmpty(clientId))
            {
                throw new Exception("Mercado Pago Client ID (App ID) no está configurado.");
            }

            return $"https://auth.mercadopago.com/authorization?client_id={clientId}&response_type=code&platform_id=mp&state={state}&redirect_uri={Uri.EscapeDataString(redirectUri)}";
        }

        public async Task<bool> ExchangeCodeForTokenAsync(string code, string redirectUri)
        {
            var clientIdSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_ClientId");
            var clientSecretSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_ClientSecret");
            
            var clientId = clientIdSetting?.Value ?? _configuration["MercadoPago:ClientId"];
            var clientSecret = clientSecretSetting?.Value ?? _configuration["MercadoPago:ClientSecret"];

            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            {
                throw new Exception("Mercado Pago Client ID o Client Secret no están configurados.");
            }

            var url = "https://api.mercadopago.com/oauth/token";
            
            var payload = new System.Collections.Generic.Dictionary<string, string>
            {
                { "client_id", clientId },
                { "client_secret", clientSecret },
                { "grant_type", "authorization_code" },
                { "code", code },
                { "redirect_uri", redirectUri }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Content = new FormUrlEncodedContent(payload);

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"Error al intercambiar código por token: {error}");
            }

            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;

            string accessToken = root.GetProperty("access_token").GetString();
            string refreshToken = root.GetProperty("refresh_token").GetString();
            int expiresIn = root.GetProperty("expires_in").GetInt32();
            DateTime expiryDate = DateTime.UtcNow.AddSeconds(expiresIn);

            await SaveOrUpdateSettingAsync("MercadoPago_AccessToken", accessToken);
            await SaveOrUpdateSettingAsync("MercadoPago_RefreshToken", refreshToken);
            await SaveOrUpdateSettingAsync("MercadoPago_TokenExpiry", expiryDate.ToString("o"));

            return true;
        }

        public async Task<bool> RefreshTokenAsync()
        {
            var clientIdSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_ClientId");
            var clientSecretSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_ClientSecret");
            var refreshTokenSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "MercadoPago_RefreshToken");
            
            var clientId = clientIdSetting?.Value ?? _configuration["MercadoPago:ClientId"];
            var clientSecret = clientSecretSetting?.Value ?? _configuration["MercadoPago:ClientSecret"];
            var refreshToken = refreshTokenSetting?.Value;

            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret) || string.IsNullOrEmpty(refreshToken))
            {
                return false;
            }

            var url = "https://api.mercadopago.com/oauth/token";
            
            var payload = new System.Collections.Generic.Dictionary<string, string>
            {
                { "client_id", clientId },
                { "client_secret", clientSecret },
                { "grant_type", "refresh_token" },
                { "refresh_token", refreshToken }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Content = new FormUrlEncodedContent(payload);

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;

            string newAccessToken = root.GetProperty("access_token").GetString();
            string newRefreshToken = root.GetProperty("refresh_token").GetString();
            int expiresIn = root.GetProperty("expires_in").GetInt32();
            DateTime expiryDate = DateTime.UtcNow.AddSeconds(expiresIn);

            await SaveOrUpdateSettingAsync("MercadoPago_AccessToken", newAccessToken);
            await SaveOrUpdateSettingAsync("MercadoPago_RefreshToken", newRefreshToken);
            await SaveOrUpdateSettingAsync("MercadoPago_TokenExpiry", expiryDate.ToString("o"));

            return true;
        }

        private async Task SaveOrUpdateSettingAsync(string key, string value)
        {
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
            if (setting == null)
            {
                _context.SystemSettings.Add(new SystemSetting
                {
                    Key = key,
                    Value = value,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                setting.Value = value;
                setting.UpdatedAt = DateTime.UtcNow;
                _context.Entry(setting).State = EntityState.Modified;
            }
            await _context.SaveChangesAsync();
        }
    }
}
