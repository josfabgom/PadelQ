using System;

namespace PadelQ.Domain.Entities
{
    public class Supplier
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ContactInfo { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
