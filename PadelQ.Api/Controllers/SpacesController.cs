using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/spaces")]
    [Authorize]
    public class SpacesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public SpacesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Space>>> GetSpaces()
        {
            return await _context.Spaces.Where(s => s.IsActive).ToListAsync();
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Space>> CreateSpace(Space space)
        {
            _context.Spaces.Add(space);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetSpaces), new { id = space.Id }, space);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSpace(int id, Space space)
        {
            if (id != space.Id) return BadRequest();
            _context.Entry(space).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteSpace(int id)
        {
            var space = await _context.Spaces.FindAsync(id);
            if (space == null) return NotFound();
            space.IsActive = false;
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
