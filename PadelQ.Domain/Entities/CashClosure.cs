using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class CashClosure
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public DateTime OpeningDate { get; set; } = DateTime.UtcNow;

        public DateTime? ClosingDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InitialCash { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ExpectedCash { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ActualCash { get; set; }

        public string? Notes { get; set; }

        [Required]
        public string OpenedBy { get; set; } = string.Empty;

        public string? ClosedBy { get; set; }

        public bool IsOpen { get; set; } = true;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalCashSales { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalTransferSales { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalCardSales { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalOtherSales { get; set; }
    }
}
