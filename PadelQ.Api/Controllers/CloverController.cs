using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CloverController : ControllerBase
    {
        private readonly ICloverService _cloverService;
        private readonly PadelQ.Infrastructure.Persistence.ApplicationDbContext _context;

        public CloverController(ICloverService cloverService, PadelQ.Infrastructure.Persistence.ApplicationDbContext context)
        {
            _cloverService = cloverService;
            _context = context;
        }

        [HttpGet("settings")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetSettings()
        {
            var settings = await _context.CloverSettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                settings = new PadelQ.Domain.Entities.CloverSetting();
                _context.CloverSettings.Add(settings);
                await _context.SaveChangesAsync();
            }
            return Ok(settings);
        }

        [HttpPost("settings")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSettings([FromBody] PadelQ.Domain.Entities.CloverSetting updatedSettings)
        {
            var settings = await _context.CloverSettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                _context.CloverSettings.Add(updatedSettings);
            }
            else
            {
                settings.IsProduction = updatedSettings.IsProduction;
                settings.MerchantId = updatedSettings.MerchantId?.Trim() ?? string.Empty;
                settings.AccessToken = updatedSettings.AccessToken?.Trim() ?? string.Empty;
                settings.AppId = updatedSettings.AppId;
                settings.AppSecret = updatedSettings.AppSecret;
                settings.UpdatedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();
            return Ok(settings);
        }

        [HttpPost("charge")]
        public async Task<IActionResult> Charge([FromBody] CloverChargeRequest request)
        {
            try
            {
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                var deviceId = user?.CloverDeviceId;

                if (!string.IsNullOrWhiteSpace(request.DeviceId))
                    deviceId = request.DeviceId.Trim();

                if (string.IsNullOrWhiteSpace(deviceId))
                {
                    deviceId = await _context.Users
                        .Where(u => u.CloverDeviceId != null && u.CloverDeviceId != "")
                        .Select(u => u.CloverDeviceId)
                        .FirstOrDefaultAsync();
                }

                var result = await _cloverService.SendPaymentToDeviceAsync(request.Amount, request.OrderId, deviceId ?? string.Empty);
                
                if (result)
                    return Ok(new { Message = "Cobro enviado exitosamente al dispositivo Clover." });
                else
                    return BadRequest("Error al enviar el cobro a Clover.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("device")]
        public async Task<IActionResult> GetCloverDevice()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            var deviceId = user?.CloverDeviceId;
            if (string.IsNullOrWhiteSpace(deviceId))
            {
                deviceId = await _context.Users
                    .Where(u => u.CloverDeviceId != null && u.CloverDeviceId != "")
                    .Select(u => u.CloverDeviceId)
                    .FirstOrDefaultAsync();
            }

            return Ok(new { deviceId = deviceId ?? string.Empty });
        }

        [HttpPost("device")]
        public async Task<IActionResult> SetCloverDevice([FromBody] SetCloverDeviceRequest request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            user.CloverDeviceId = request.DeviceId?.Trim() ?? string.Empty;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Dispositivo Clover asignado exitosamente a su puesto." });
        }
    }

    public class CloverChargeRequest
    {
        public decimal Amount { get; set; }
        public string OrderId { get; set; } = string.Empty;
        public string DeviceId { get; set; } = string.Empty;
    }

    public class SetCloverDeviceRequest
    {
        public string DeviceId { get; set; } = string.Empty;
    }
}