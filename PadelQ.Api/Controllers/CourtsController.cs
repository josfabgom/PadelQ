using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [Authorize(Roles = "Admin,Staff")]
    public class CourtsController : ControllerBase
    {
        private readonly ICourtService _courtService;

        public CourtsController(ICourtService courtService)
        {
            _courtService = courtService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Court>>> GetCourts()
        {
            return Ok(await _courtService.GetAllAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Court>> GetCourt(int id)
        {
            var court = await _courtService.GetByIdAsync(id);
            if (court == null) return NotFound();
            return Ok(court);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<ActionResult<int>> CreateCourt([FromBody] Court court)
        {
            var id = await _courtService.CreateAsync(court);
            return CreatedAtAction(nameof(GetCourt), new { id }, id);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> UpdateCourt(int id, [FromBody] Court court)
        {
            if (id != court.Id) return BadRequest();
            await _courtService.UpdateAsync(court);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteCourt(int id)
        {
            await _courtService.DeleteAsync(id);
            return NoContent();
        }
    }
}
