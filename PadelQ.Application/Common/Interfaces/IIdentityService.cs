using System;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IIdentityService
    {
        Task<(bool Succeeded, string UserId)> CreateUserAsync(string userName, string email, string password);
        Task<string?> LoginAsync(string email, string password);
        Task<bool> IsEmailUniqueAsync(string email);
        Task<List<PadelQ.Application.Common.Models.UserDto>> GetUsersAsync();
        Task<PadelQ.Application.Common.Models.UserDto?> GetUserByIdAsync(string userId);
        Task<bool> UpdateUserAsync(string userId, string fullName, string email);
        Task<bool> DeleteUserAsync(string userId);
    }
}
