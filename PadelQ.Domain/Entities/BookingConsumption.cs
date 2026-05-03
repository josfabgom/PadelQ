using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class BookingConsumption
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid? BookingId { get; set; }
        
        public Guid? SpaceBookingId { get; set; }

        [Required]
        public int ProductId { get; set; }

        [Required]
        public int Quantity { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalPrice => UnitPrice * Quantity;

        public string? Notes { get; set; }

        public bool IsPaid { get; set; } = false;
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositPaid { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("BookingId")]
        public virtual Booking? Booking { get; set; }

        [ForeignKey("SpaceBookingId")]
        public virtual SpaceBooking? SpaceBooking { get; set; }

        [ForeignKey("ProductId")]
        public virtual Product? Product { get; set; }
    }
}
