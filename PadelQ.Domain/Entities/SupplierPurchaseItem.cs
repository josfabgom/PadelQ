using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class SupplierPurchaseItem
    {
        [Key]
        public int Id { get; set; }

        public int SupplierPurchaseId { get; set; }
        
        [ForeignKey("SupplierPurchaseId")]
        public SupplierPurchase? SupplierPurchase { get; set; }

        public int ProductId { get; set; }
        
        [ForeignKey("ProductId")]
        public Product? Product { get; set; }

        public int Quantity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; }
    }
}
