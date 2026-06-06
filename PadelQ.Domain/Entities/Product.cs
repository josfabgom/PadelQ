using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class Product
    {
        [Key]
        public int Id { get; set; }

        [StringLength(50)]
        public string? InternalCode { get; set; }

        [StringLength(100)]
        public string? Barcode { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal FinalPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal CostPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MarginPercentage { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal IvaPercentage { get; set; } = 21;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InternalTaxAmount { get; set; } = 0;

        public int Stock { get; set; }
        public int MinimumStock { get; set; }


        public string? ImageUrl { get; set; }

        public string? Category { get; set; }

        public bool IsActive { get; set; } = true;

        public bool IsDoubleUnitCombo { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
