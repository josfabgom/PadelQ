using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class ActivitySignup
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public int ActivityId { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        public DateTime SignupDate { get; set; } = DateTime.UtcNow;

        [ForeignKey("ActivityId")]
        public virtual ClubActivity? Activity { get; set; }

        [ForeignKey("UserId")]
        public virtual ApplicationUser? User { get; set; }
    }
}
