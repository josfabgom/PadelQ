using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;

namespace PadelQ.Domain.Entities
{
    public class ApplicationUser : IdentityUser
    {
        public string? FullName { get; set; }
        public string? Dni { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PhotoUrl { get; set; }
        public decimal PlayerLevel { get; set; } = 1.0m;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public bool CanAccessActivities { get; set; } = true;
        public bool CanAccessBookings { get; set; } = true;

        public virtual ICollection<UserMembership> UserMemberships { get; set; } = new List<UserMembership>();
        public virtual ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    }
}
