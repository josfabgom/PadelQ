using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IIdentityService
    {
        Task<(bool Succeeded, string UserId)> CreateUserAsync(string userName, string email, string password, string fullName, string? dni, string? phoneNumber);
        Task<(string Token, string FullName, string Email)?> LoginAsync(string email, string password);
        Task<bool> IsEmailUniqueAsync(string email);
        Task<List<PadelQ.Application.Common.Models.UserDto>> GetUsersAsync();
        Task<PadelQ.Application.Common.Models.UserDto?> GetUserByIdAsync(string userId);
        Task<(bool Succeeded, string Message)> UpdateUserAsync(string userId, string fullName, string email, string? phoneNumber, bool isActive, string? dni, string? address, string? city, string? province, string? photoUrl);
        Task<bool> DeleteUserAsync(string userId);
    }
}
