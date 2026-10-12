using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Infrastructure.Persistence;

namespace PadelQ.Infrastructure.Services
{
    public class CloverService : ICloverService
    {
        private readonly HttpClient _httpClient;
        private readonly ApplicationDbContext _context;

        public CloverService(HttpClient httpClient, ApplicationDbContext context)
        {
            _httpClient = httpClient;
            _context = context;
        }

        public async Task<bool> SendPaymentToDeviceAsync(decimal amount, string orderId, string deviceId)
        {
            var settings = await _context.CloverSettings.FirstOrDefaultAsync();
            if (settings == null || string.IsNullOrEmpty(settings.AccessToken))
            {
                throw new Exception("Clover no está configurado.");
            }

            string baseUrl = settings.IsProduction ? "https://api.clover.com" : "https://sandbox.dev.clover.com";
            
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", settings.AccessToken);

            var payload = new
            {
                amount = (long)(amount * 100), // Clover usa centavos
                externalReferenceId = orderId
            };

            // URL teórica para Cloud Pay Display API
                        var response = await _httpClient.PostAsJsonAsync($"{baseUrl}/v1/device/v1/elements/{deviceId}/payments", payload);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new Exception($"Clover API Error: {response.StatusCode} - {errorContent}");
            }

            return true;
        }

        public async Task<string> GetPaymentStatusAsync(string paymentId)
        {
            // Simulación de consulta de estado
            return await Task.FromResult("SUCCESS");
        }
    }
}



