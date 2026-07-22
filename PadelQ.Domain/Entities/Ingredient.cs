using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class Ingredient
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string UnitOfMeasure { get; set; } = "uds";

        [Column(TypeName = "decimal(18,2)")]
        public decimal Stock { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal MinimumStock { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal CostPrice { get; set; } = 0;

        public bool IsActive { get; set; } = true;
        
        public string? Category { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
