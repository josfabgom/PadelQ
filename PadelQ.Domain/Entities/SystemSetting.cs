using System;
using System.ComponentModel.DataAnnotations;

namespace PadelQ.Domain.Entities
{
    public class SystemSetting
    {
        [Key]
        public string Key { get; set; } = string.Empty;
        
        [Required]
        public string Value { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
