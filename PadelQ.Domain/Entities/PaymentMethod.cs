using System.ComponentModel.DataAnnotations;

namespace PadelQ.Domain.Entities
{
    public class PaymentMethod
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Name { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public string? IconName { get; set; } // For Lucide icons in frontend
        public string? HexColor { get; set; }
    }
}
