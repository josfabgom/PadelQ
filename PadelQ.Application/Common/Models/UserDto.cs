namespace PadelQ.Application.Common.Models
{
    public class UserDto
    {
        public string Id { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string? Dni { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PhotoUrl { get; set; }
        public decimal Balance { get; set; }
        public string? MembershipName { get; set; }
        public decimal DiscountPercentage { get; set; }
        public string? MembershipHexColor { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
