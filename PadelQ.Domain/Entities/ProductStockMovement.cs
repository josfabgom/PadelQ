using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public enum MovementType
    {
        Purchase = 0,    // Ingreso por compra
        Adjustment = 1,  // Ajuste manual
        Sale = 2         // Salida por venta
    }

    public class ProductStockMovement
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ProductId { get; set; }

        [ForeignKey("ProductId")]
        public Product? Product { get; set; }

        [Required]
        public MovementType Type { get; set; }

        [Required]
        public int Quantity { get; set; } // Can be negative for Sales/Adjustments

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
