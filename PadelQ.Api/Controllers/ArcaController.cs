using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Threading.Tasks;
using System.IO;
using System.Text;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin")] // Uncomment when auth is needed
    public class ArcaController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IArcaService _arcaService;

        public ArcaController(ApplicationDbContext context, IArcaService arcaService)
        {
            _context = context;
            _arcaService = arcaService;
        }

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var setting = await _context.ArcaSettings.FirstOrDefaultAsync();
            if (setting == null)
            {
                setting = new ArcaSetting();
                _context.ArcaSettings.Add(setting);
                await _context.SaveChangesAsync();
            }

            return Ok(new {
                setting.IsProduction,
                setting.CuitEmisor,
                setting.PuntoDeVenta,
                setting.CondicionIva,
                HasPrivateKey = !string.IsNullOrEmpty(setting.PrivateKeyPem),
                HasCertificate = !string.IsNullOrEmpty(setting.CertificateCrtPem)
            });
        }

        [HttpPost("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] ArcaSettingDto dto)
        {
            var setting = await _context.ArcaSettings.FirstOrDefaultAsync();
            if (setting == null)
            {
                setting = new ArcaSetting();
                _context.ArcaSettings.Add(setting);
            }

            setting.IsProduction = dto.IsProduction;
            setting.CuitEmisor = dto.CuitEmisor;
            setting.PuntoDeVenta = dto.PuntoDeVenta;
            setting.CondicionIva = dto.CondicionIva;
            setting.UpdatedAt = System.DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("generate-csr")]
        public async Task<IActionResult> GenerateCsr([FromBody] CsrRequestDto dto)
        {
            if (string.IsNullOrEmpty(dto.Cuit) || string.IsNullOrEmpty(dto.CommonName))
                return BadRequest("Cuit y Nombre de fantasía son obligatorios.");

            var (privateKey, csr) = await _arcaService.GenerateCsrAsync(dto.Cuit, dto.CommonName);

            var setting = await _context.ArcaSettings.FirstOrDefaultAsync();
            if (setting == null)
            {
                setting = new ArcaSetting();
                _context.ArcaSettings.Add(setting);
            }
            
            setting.PrivateKeyPem = privateKey;
            setting.CuitEmisor = dto.Cuit;
            await _context.SaveChangesAsync();

            var bytes = Encoding.UTF8.GetBytes(csr);
            return File(bytes, "application/pkcs10", "pedido_certificado.csr");
        }

        [HttpPost("upload-certificate")]
        public async Task<IActionResult> UploadCertificate()
        {
            if (!Request.HasFormContentType || Request.Form.Files.Count == 0)
                return BadRequest("No se envió ningún archivo.");

            var file = Request.Form.Files[0];
            using var reader = new StreamReader(file.OpenReadStream());
            var crtContent = await reader.ReadToEndAsync();

            if (!crtContent.Contains("BEGIN CERTIFICATE"))
                return BadRequest("El archivo no parece ser un certificado válido (formato PEM requerido).");

            var setting = await _context.ArcaSettings.FirstOrDefaultAsync();
            if (setting == null) return NotFound("Configuración no inicializada.");

            setting.CertificateCrtPem = crtContent;
            await _context.SaveChangesAsync();

            return Ok();
        }

        [HttpPost("test-connection")]
        public async Task<IActionResult> TestConnection()
        {
            try
            {
                var result = await _arcaService.TestConnectionAsync();
                return Ok(new { success = result });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }

    public class ArcaSettingDto
    {
        public bool IsProduction { get; set; }
        public string CuitEmisor { get; set; }
        public int PuntoDeVenta { get; set; }
        public string CondicionIva { get; set; }
    }

    public class CsrRequestDto
    {
        public string Cuit { get; set; }
        public string CommonName { get; set; }
    }
}
