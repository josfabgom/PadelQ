using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IBillingService
    {
        /// <summary>
        /// Generates monthly charges for active memberships according to their expiration date
        /// and a tolerance period.
        /// </summary>
        /// <returns>Number of charges created</returns>
        Task<int> GenerateMonthlyChargesAsync();
    }
}

