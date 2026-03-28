using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin")] // Optional: protect this endpoint
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
            var (succeeded, userId) = await _identityService.CreateUserAsync(request.FullName, request.Email, request.Password);
            if (!succeeded) return BadRequest("No se pudo crear el usuario.");
            return Ok(new { Id = userId });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request)
        {
            var succeeded = await _identityService.UpdateUserAsync(id, request.FullName, request.Email);
            if (!succeeded) return BadRequest("No se pudo actualizar el usuario.");
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            var succeeded = await _identityService.DeleteUserAsync(id);
            if (!succeeded) return BadRequest("No se pudo eliminar el usuario.");
            return NoContent();
        }
    }

    public record CreateUserRequest(string FullName, string Email, string Password);
    public record UpdateUserRequest(string FullName, string Email);
}
