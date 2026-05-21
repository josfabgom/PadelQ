using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IChatbotService
    {
        Task<ChatbotResponseDto> ProcessChatMessageAsync(string userId, string message, List<ChatMessageDto> history);
        Task<ChatbotResponseDto> ProcessPublicChatMessageAsync(string message, List<ChatMessageDto> history);
    }

    public class ChatMessageDto
    {
        public string Role { get; set; } = ""; // "user" or "model"
        public string Text { get; set; } = "";
    }

    public class ChatbotResponseDto
    {
        public string Reply { get; set; } = "";
        public string Action { get; set; } = "none"; // "none", "create_booking"
        public int? CourtId { get; set; }
        public DateTime? StartTime { get; set; }
        public int? DurationMinutes { get; set; }
        public string? GuestDni { get; set; }
        public string? GuestName { get; set; }
        public string? GuestPhone { get; set; }
        public string? GuestEmail { get; set; }
        public bool Success { get; set; } = true;
    }
}
