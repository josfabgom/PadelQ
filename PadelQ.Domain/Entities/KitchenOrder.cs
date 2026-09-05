using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class KitchenOrder
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int OrderNumber { get; set; }

        public KitchenOrderStatus Status { get; set; } = KitchenOrderStatus.Pending;

        public Guid? BookingId { get; set; }
        public Guid? SpaceBookingId { get; set; }
        public string? UserId { get; set; }
        
        [StringLength(100)]
        public string? CustomerName { get; set; }

        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }

        public virtual ICollection<KitchenOrderItem> Items { get; set; } = new List<KitchenOrderItem>();

        [ForeignKey("BookingId")]
        public virtual Booking? Booking { get; set; }

        [ForeignKey("SpaceBookingId")]
        public virtual SpaceBooking? SpaceBooking { get; set; }

        [ForeignKey("UserId")]
        public virtual ApplicationUser? User { get; set; }
    }
}
