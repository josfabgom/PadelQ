using PadelQ.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IActivityService
    {
        Task<IEnumerable<ClubActivity>> GetAllAsync();
        Task<ClubActivity?> GetByIdAsync(int id);
        Task<int> CreateAsync(ClubActivity activity);
        Task UpdateAsync(ClubActivity activity);
        Task DeleteAsync(int id);
        Task<(bool Succeeded, string Message)> SignupAsync(string userId, int activityId);
    }
}
