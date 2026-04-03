using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class UsersController : ControllerBase
    {
        private readonly IIdentityService _identityService;

        public UsersController(IIdentityService identityService)
        {
            _identityService = identityService;
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _identityService.GetUsersAsync();
            return Ok(users);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            var user = await _identityService.GetUserByIdAsync(id);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            var (succeeded, result) = await _identityService.CreateUserAsync(request.Email, request.Email, request.Password, request.FullName, request.Dni, request.PhoneNumber, request.Role ?? "User");
            if (!succeeded) return BadRequest(result ?? "No se pudo crear el usuario.");
            return Ok(new { Id = result });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request)
        {
            var (succeeded, message) = await _identityService.UpdateUserAsync(id, request.FullName, request.Email, request.PhoneNumber, request.IsActive, request.Dni, request.Address, request.City, request.Province, request.PhotoUrl, request.Role);
            if (!succeeded) return BadRequest(message ?? "No se pudo actualizar el usuario.");
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            try 
            {
                var succeeded = await _identityService.DeleteUserAsync(id);
                if (!succeeded) return BadRequest("No se pudo eliminar el usuario.");
                return NoContent();
            }
            catch (System.InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{id}/change-password")]
        public async Task<IActionResult> ChangePassword(string id, [FromBody] ChangePasswordRequest request)
        {
            var (succeeded, message) = await _identityService.ChangePasswordAsync(id, request.NewPassword);
            if (!succeeded) return BadRequest(message);
            return Ok(new { Message = "Contraseña actualizada correctamente" });
        }
    }

    public record CreateUserRequest(string FullName, string Email, string Password, string? Dni, string? PhoneNumber, string? Role);
    public record UpdateUserRequest(string FullName, string Email, string? PhoneNumber, bool IsActive, string? Dni, string? Address, string? City, string? Province, string? PhotoUrl, string? Role);
    public record ChangePasswordRequest(string NewPassword);
}
