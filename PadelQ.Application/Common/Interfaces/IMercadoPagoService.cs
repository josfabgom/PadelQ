using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IMercadoPagoService
    {
        Task<string> CreateQrOrderAsync(int terminalId, decimal amount, string description, string referenceId);
        Task<dynamic> GetPaymentAsync(string paymentId);
    }
}
