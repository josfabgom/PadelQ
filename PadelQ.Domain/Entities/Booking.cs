using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Collections.Generic;

namespace PadelQ.Domain.Entities
{
    public class Booking
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public string? UserId { get; set; }
        public string? GuestName { get; set; }
        public string? GuestPhone { get; set; }
        public string? GuestEmail { get; set; }

        [Required]
        public int CourtId { get; set; }

        [Required]
        public DateTime StartTime { get; set; }

        [Required]
        public DateTime EndTime { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }

        public BookingStatus Status { get; set; } = BookingStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties for EF Core
        [ForeignKey("UserId")]
        public virtual ApplicationUser? User { get; set; }

        [ForeignKey("CourtId")]
        public virtual Court? Court { get; set; }

        public Guid? RecurrenceGroupId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositPaid { get; set; } = 0;

        public virtual ICollection<BookingConsumption> BookingConsumptions { get; set; } = new List<BookingConsumption>();
    }

    public enum BookingStatus
    {
        Pending,
        Confirmed,
        Cancelled,
        NoShow,
        Paid
    }
}
