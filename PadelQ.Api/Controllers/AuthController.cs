using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Linq;

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
            var (succeeded, userId) = await _identityService.CreateUserAsync(request.Email, request.Email, request.Password, request.FullName, null, null);
            if (!succeeded) return BadRequest("Registration failed.");

            return Ok(new { UserId = userId });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var result = await _identityService.LoginAsync(request.Email, request.Password);
            if (result == null) return Unauthorized("Invalid credentials.");
 
            var (token, fullName, email, roles) = result.Value;

            return Ok(new 
            { 
                Token = token,
                FullName = fullName,
                Email = email,
                Roles = roles
            });
        }

        [HttpGet("whoami")]
        [Authorize]
        public IActionResult WhoAmI()
        {
            return Ok(new
            {
                UserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                Email = User.FindFirstValue(ClaimTypes.Email),
                Roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value),
                Claims = User.Claims.Select(c => new { c.Type, c.Value })
            });
        }
    }

    public record RegisterRequest(string FullName, string Email, string Password);
    public record LoginRequest(string Email, string Password);
}
