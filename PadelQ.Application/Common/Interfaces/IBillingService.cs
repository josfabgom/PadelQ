using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IBillingService
    {
        Task<int> GenerateMonthlyChargesAsync();
    }
}
