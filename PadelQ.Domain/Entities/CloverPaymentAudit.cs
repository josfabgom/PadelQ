using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class CloverPaymentAudit
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(64)]
        public string ExternalPaymentId { get; set; } = string.Empty;

        [StringLength(64)]
        public string? CloverPaymentId { get; set; }

        [StringLength(64)]
        public string? CloverOrderId { get; set; }

        [StringLength(128)]
        public string? OrderReference { get; set; }

        [StringLength(64)]
        public string SourceModule { get; set; } = "Cobro POS";

        [StringLength(200)]
        public string? ClientName { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        [StringLength(128)]
        public string? ProcessedBy { get; set; }

        [StringLength(64)]
        public string DeviceId { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        [StringLength(32)]
        public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, CANCELLED, ERROR, TIMEOUT

        [StringLength(500)]
        public string? StatusDetail { get; set; }

        [StringLength(50)]
        public string? CardBrand { get; set; }

        [StringLength(16)]
        public string? CardLast4 { get; set; }

        [StringLength(64)]
        public string? AuthCode { get; set; }

        [StringLength(64)]
        public string? EntryType { get; set; }

        public Guid? PaymentGroupId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? CompletedAt { get; set; }
    }
}
