using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IIdentityService _identityService;

        public AuthController(IIdentityService identityService)
        {
            _identityService = identityService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var (succeeded, userId) = await _identityService.CreateUserAsync(request.FullName, request.Email, request.Password);
            if (!succeeded) return BadRequest("Registration failed.");

            return Ok(new { UserId = userId });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var token = await _identityService.LoginAsync(request.Email, request.Password);
            if (token == null) return Unauthorized("Invalid credentials.");

            return Ok(new { Token = token });
        }
    }

    public record RegisterRequest(string FullName, string Email, string Password);
    public record LoginRequest(string Email, string Password);
}
