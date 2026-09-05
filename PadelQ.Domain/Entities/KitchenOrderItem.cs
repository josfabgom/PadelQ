using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class KitchenOrderItem
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid KitchenOrderId { get; set; }

        [Required]
        public Guid BookingConsumptionId { get; set; }

        [Required]
        public int ProductId { get; set; }

        [Required]
        public int Quantity { get; set; }

        public string? Notes { get; set; }

        [ForeignKey("KitchenOrderId")]
        public virtual KitchenOrder? KitchenOrder { get; set; }

        [ForeignKey("BookingConsumptionId")]
        public virtual BookingConsumption? BookingConsumption { get; set; }

        [ForeignKey("ProductId")]
        public virtual Product? Product { get; set; }
    }
}
