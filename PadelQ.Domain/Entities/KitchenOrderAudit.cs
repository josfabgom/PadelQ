using System;

namespace PadelQ.Domain.Entities
{
    public class KitchenOrderAudit
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public Guid KitchenOrderId { get; set; }
        public KitchenOrder? KitchenOrder { get; set; }
        
        public KitchenOrderStatus? FromStatus { get; set; }
        public KitchenOrderStatus ToStatus { get; set; }
        
        public string ChangedBy { get; set; } = string.Empty;
        
        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    }
}
