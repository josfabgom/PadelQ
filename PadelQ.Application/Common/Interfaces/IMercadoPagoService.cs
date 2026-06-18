using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IMercadoPagoService
    {
        Task<string> CreateQrOrderAsync(int terminalId, decimal amount, string description, string referenceId);
        Task<dynamic> GetPaymentAsync(string paymentId);
        Task<string> GetOAuthUrlAsync(string state, string redirectUri);
        Task<bool> ExchangeCodeForTokenAsync(string code, string redirectUri);
        Task<bool> RefreshTokenAsync();
    }
}
