namespace PadelQ.Application.Common.Models
{
    public class UserDto
    {
        public string Id { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public decimal Balance { get; set; }
        public string? MembershipName { get; set; }
    }
}
