using System;
using System.ComponentModel.DataAnnotations;

namespace PadelQ.Domain.Entities
{
    public class CloverSetting
    {
        [Key]
        public int Id { get; set; }

        public bool IsProduction { get; set; } = false;

        [StringLength(100)]
        public string? MerchantId { get; set; }

        [StringLength(255)]
        public string? AccessToken { get; set; }

        [StringLength(100)]
        public string? AppId { get; set; }
        
        [StringLength(255)]
        public string? AppSecret { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
