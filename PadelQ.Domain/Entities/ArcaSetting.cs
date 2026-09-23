using System;
using System.ComponentModel.DataAnnotations;

namespace PadelQ.Domain.Entities
{
    public class ArcaSetting
    {
        [Key]
        public int Id { get; set; }

        public bool IsProduction { get; set; } = false;

        [StringLength(20)]
        public string? CuitEmisor { get; set; }

        public int PuntoDeVenta { get; set; } = 1;

        // Ej: "Responsable Inscripto", "Monotributo"
        [StringLength(50)]
        public string? CondicionIva { get; set; } 

        public string? PrivateKeyPem { get; set; }
        
        public string? CertificateCrtPem { get; set; }

        public string? WsaaToken { get; set; }
        
        public string? WsaaSign { get; set; }
        
        public DateTime? WsaaExpiration { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
