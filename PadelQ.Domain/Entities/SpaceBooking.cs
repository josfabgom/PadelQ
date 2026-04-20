using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class SpaceBooking
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public int SpaceId { get; set; }
        public string? UserId { get; set; }

        // Datos del cliente (Particular o App)
        public string? GuestName { get; set; }
        public string? GuestAddress { get; set; }
        public string? GuestPhone { get; set; }
        public string? GuestEmail { get; set; }

        [Required]
        public DateTime StartTime { get; set; }

        [Required]
        public DateTime EndTime { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositPaid { get; set; } = 0;

        public BookingStatus Status { get; set; } = BookingStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("SpaceId")]
        public virtual Space? Space { get; set; }

        [ForeignKey("UserId")]
        public virtual ApplicationUser? User { get; set; }
    }
}
