using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Infrastructure.Persistence;
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
    }
}
