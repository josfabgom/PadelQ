using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PointTerminalsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PointTerminalsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetTerminals()
        {
            var terminals = await _context.PointTerminals.Where(t => t.IsActive).ToListAsync();
            return Ok(terminals);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTerminal([FromBody] PointTerminal terminal)
        {
            if (string.IsNullOrEmpty(terminal.Name) || string.IsNullOrEmpty(terminal.ExternalPosId))
            {
                return BadRequest("Name and ExternalPosId are required.");
            }

            terminal.CreatedAt = System.DateTime.UtcNow;
            terminal.IsActive = true;
            _context.PointTerminals.Add(terminal);
            await _context.SaveChangesAsync();

            return Ok(terminal);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTerminal(int id)
        {
            var terminal = await _context.PointTerminals.FindAsync(id);
            if (terminal == null) return NotFound();

            terminal.IsActive = false; // Soft delete
            await _context.SaveChangesAsync();

            return Ok();
        }
    }
}
