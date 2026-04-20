using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly IIdentityService _identityService;

        public UsersController(IIdentityService identityService)
        {
            _identityService = identityService;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _identityService.GetUsersAsync();
            return Ok(users);
        }

        [HttpGet("check-dni")]
        public async Task<IActionResult> GetByDni([FromQuery] string dni)
        {
            if (string.IsNullOrEmpty(dni)) return BadRequest("DNI is required");
            var user = await _identityService.GetUserByDniAsync(dni);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            // Allow if it is Admin/Staff OR if it is the user themselves
            var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                               ?? User.FindFirst("sub")?.Value 
                               ?? User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
            
            if (!User.IsInRole("Admin") && !User.IsInRole("Staff") && currentUserId != id)
            {
                return Forbid();
            }

            var user = await _identityService.GetUserByIdAsync(id);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            // Only Admin can assign roles besides User
            var assignedRole = request.Role ?? "User";
            if (!User.IsInRole("Admin") && assignedRole != "User")
            {
                return BadRequest("Solo el administrador puede asignar roles especiales.");
            }

            var (succeeded, result) = await _identityService.CreateUserAsync(request.Email, request.Email, request.Password, request.FullName, request.Dni, request.PhoneNumber, assignedRole);
            if (!succeeded) return BadRequest(result ?? "No se pudo crear el usuario.");
            return Ok(new { Id = result });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request)
        {
            // Only Admin can change or assign roles
            if (!User.IsInRole("Admin"))
            {
                var existingUser = await _identityService.GetUserByIdAsync(id);
                if (existingUser != null && existingUser.Role != request.Role)
                {
                    return BadRequest("Solo el administrador puede cambiar los roles de los usuarios.");
                }
            }

            var (succeeded, message) = await _identityService.UpdateUserAsync(id, request.FullName, request.Email, request.PhoneNumber, request.IsActive, request.Dni, request.Address, request.City, request.Province, request.PhotoUrl, request.Role, request.CanAccessActivities, request.CanAccessBookings);
            if (!succeeded) return BadRequest(message ?? "No se pudo actualizar el usuario.");
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
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
            var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                               ?? User.FindFirst("sub")?.Value 
                               ?? User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
            
            if (!User.IsInRole("Admin") && currentUserId != id)
            {
                return Forbid();
            }

            var (succeeded, message) = await _identityService.ChangePasswordAsync(id, request.NewPassword);
            if (!succeeded) return BadRequest(message);
            return Ok(new { Message = "Contraseña actualizada correctamente" });
        }
    }

    public record CreateUserRequest(string FullName, string Email, string Password, string? Dni, string? PhoneNumber, string? Role);
    public record UpdateUserRequest(string FullName, string Email, string? PhoneNumber, bool IsActive, string? Dni, string? Address, string? City, string? Province, string? PhotoUrl, string? Role, bool CanAccessActivities = true, bool CanAccessBookings = true);
    public record ChangePasswordRequest(string NewPassword);
}
