using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PadelQ.Application.Common.Interfaces;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ChatbotController : ControllerBase
    {
        private readonly IChatbotService _chatbotService;

        public ChatbotController(IChatbotService chatbotService)
        {
            _chatbotService = chatbotService;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            if (string.IsNullOrEmpty(request.Message))
            {
                return BadRequest("El mensaje no puede estar vacío.");
            }

            var response = await _chatbotService.ProcessChatMessageAsync(
                userId,
                request.Message,
                request.History ?? new List<ChatMessageDto>()
            );

            return Ok(response);
        }

        [AllowAnonymous]
        [HttpPost("public-chat")]
        public async Task<IActionResult> PublicChat([FromBody] ChatRequest request)
        {
            if (string.IsNullOrEmpty(request.Message))
            {
                return BadRequest("El mensaje no puede estar vacío.");
            }

            var response = await _chatbotService.ProcessPublicChatMessageAsync(
                request.Message,
                request.History ?? new List<ChatMessageDto>()
            );

            return Ok(response);
        }
    }

    public class ChatRequest
    {
        public string Message { get; set; } = "";
        public List<ChatMessageDto>? History { get; set; }
    }
}
