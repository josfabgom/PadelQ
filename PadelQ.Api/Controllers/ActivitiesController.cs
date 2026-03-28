using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ActivitiesController : ControllerBase
    {
        private readonly IActivityService _activityService;

        public ActivitiesController(IActivityService activityService)
        {
            _activityService = activityService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ClubActivity>>> GetActivities()
        {
            return Ok(await _activityService.GetAllAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ClubActivity>> GetActivity(int id)
        {
            var activity = await _activityService.GetByIdAsync(id);
            if (activity == null) return NotFound();
            return Ok(activity);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<int>> CreateActivity([FromBody] ClubActivity activity)
        {
            var id = await _activityService.CreateAsync(activity);
            return CreatedAtAction(nameof(GetActivity), new { id }, id);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateActivity(int id, [FromBody] ClubActivity activity)
        {
            if (id != activity.Id) return BadRequest();
            await _activityService.UpdateAsync(activity);
            return NoContent();
        }

        [HttpPost("{id}/signup")]
        [Authorize]
        public async Task<ActionResult> Signup(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var (Succeeded, Message) = await _activityService.SignupAsync(userId, id);
            if (!Succeeded) return BadRequest(new { message = Message });

            return Ok(new { message = Message });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteActivity(int id)
        {
            await _activityService.DeleteAsync(id);
            return NoContent();
        }
    }
}
