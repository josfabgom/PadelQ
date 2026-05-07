using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class SupplierPurchase
    {
        [Key]
        public int Id { get; set; }

        public int SupplierId { get; set; }
        
        [ForeignKey("SupplierId")]
        public Supplier? Supplier { get; set; }

        public DateTime PurchaseDate { get; set; }

        [StringLength(50)]
        public string? InvoiceNumber { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<SupplierPurchaseItem> Items { get; set; } = new List<SupplierPurchaseItem>();
    }
}
