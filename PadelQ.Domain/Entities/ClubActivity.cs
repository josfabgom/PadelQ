using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class ClubActivity
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? InstructorName { get; set; }
        public decimal Price { get; set; }
        public int MaxCapacity { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [NotMapped]
        public int CurrentSignups { get; set; }

        public virtual ICollection<ActivitySchedule> Schedules { get; set; } = new List<ActivitySchedule>();
    }
}
