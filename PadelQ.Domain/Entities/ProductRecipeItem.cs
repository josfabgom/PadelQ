using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class ProductRecipeItem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RecipeProductId { get; set; }

        [ForeignKey("RecipeProductId")]
        public virtual Product? RecipeProduct { get; set; }

        [Required]
        public int BaseProductId { get; set; }

        [ForeignKey("BaseProductId")]
        public virtual Product? BaseProduct { get; set; }

        [Required]
        public int QuantityToDeduct { get; set; } = 1;
    }
}
