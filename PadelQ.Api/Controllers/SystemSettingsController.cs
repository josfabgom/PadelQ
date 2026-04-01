using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class SystemSettingsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public SystemSettingsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<SystemSetting>>> GetSettings()
        {
            return await _context.SystemSettings.ToListAsync();
        }

        [HttpPut]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSetting([FromBody] SystemSetting setting)
        {
            var dbSetting = await _context.SystemSettings.FindAsync(setting.Key);
            if (dbSetting == null) return NotFound();

            dbSetting.Value = setting.Value;
            dbSetting.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
