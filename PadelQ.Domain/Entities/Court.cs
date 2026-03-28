using System;

namespace PadelQ.Domain.Entities
{
    public class Court
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsIndoor { get; set; }
        public string SurfaceType { get; set; } = "Glass"; // Glass, Concrete, etc.
        public decimal PricePerHour { get; set; } = 25.0m;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
