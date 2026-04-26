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
    [Route("api/systemsettings")]
    [Authorize(Roles = "Admin,Staff")]
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
            if (dbSetting == null)
            {
                _context.SystemSettings.Add(setting);
            }
            else
            {
                dbSetting.Value = setting.Value;
                dbSetting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(setting);
        }

        [HttpPost("bulk")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> BulkUpdate([FromBody] List<SystemSetting> settings)
        {
            foreach (var setting in settings)
            {
                var dbSetting = await _context.SystemSettings.FindAsync(setting.Key);
                if (dbSetting == null)
                {
                    _context.SystemSettings.Add(setting);
                }
                else
                {
                    dbSetting.Value = setting.Value;
                    dbSetting.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Configuraciones actualizadas con éxito" });
        }
    }
}
