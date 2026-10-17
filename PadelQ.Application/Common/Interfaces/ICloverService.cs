using System;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface ICloverService
    {
        Task<bool> SendPaymentToDeviceAsync(decimal amount, string orderId, string deviceId);
        Task<int> InitiatePaymentOnDeviceAsync(
            decimal amount,
            string orderId,
            string deviceId,
            string sourceModule = "Cobro POS",
            string? clientName = null,
            string? description = null,
            string? processedBy = null);
        Task<bool> CancelPaymentOnDeviceAsync(int auditId);
        Task<object> VerifyPaymentWithCloverAsync(int auditId);
        Task<string> GetPaymentStatusAsync(string paymentId);
    }
}
