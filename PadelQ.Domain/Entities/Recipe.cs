using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace PadelQ.Domain.Entities
{
    public class Recipe
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        public string? Instructions { get; set; }

        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<RecipeIngredient> RecipeIngredients { get; set; } = new List<RecipeIngredient>();

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public bool CreateProductForSale { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public decimal FinalPrice { get; set; }
    }
}
