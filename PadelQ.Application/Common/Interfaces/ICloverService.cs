using System;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface ICloverService
    {
        Task<bool> SendPaymentToDeviceAsync(decimal amount, string orderId, string deviceId);
        Task<string> GetPaymentStatusAsync(string paymentId);
    }
}
