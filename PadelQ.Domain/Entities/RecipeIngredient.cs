using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class RecipeIngredient
    {
        [Key]
        public int Id { get; set; }

        public int RecipeId { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        [ForeignKey("RecipeId")]
        public virtual Recipe? Recipe { get; set; }

        public int IngredientId { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        [ForeignKey("IngredientId")]
        public virtual Ingredient? Ingredient { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; } = 1;
    }
}
