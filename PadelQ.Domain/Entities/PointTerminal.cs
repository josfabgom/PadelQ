using System;
using System.ComponentModel.DataAnnotations;

namespace PadelQ.Domain.Entities
{
    public class PointTerminal
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string ExternalPosId { get; set; } = string.Empty;

        [MaxLength(100)]
        public string StoreId { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
