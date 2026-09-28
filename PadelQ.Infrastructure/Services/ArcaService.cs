using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Pkcs;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;

namespace PadelQ.Infrastructure.Services
{
    public class ArcaService : IArcaService
    {
        private readonly ApplicationDbContext _context;
        private readonly HttpClient _httpClient;

        public ArcaService(ApplicationDbContext context, HttpClient httpClient)
        {
            _context = context;
            _httpClient = httpClient;
        }

        public async Task<bool> TestConnectionAsync()
        {
            var setting = await _context.ArcaSettings.FirstOrDefaultAsync();
            if (setting == null) throw new Exception("Configuración de ARCA no encontrada");

            string wsfeUrl = setting.IsProduction 
                ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx" 
                : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";

            string soapBody = @"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance"" xmlns:xsd=""http://www.w3.org/2001/XMLSchema"" xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <FEDummy xmlns=""http://ar.gov.afip.dif.FEV1/"" />
  </soap:Body>
</soap:Envelope>";

            var request = new HttpRequestMessage(HttpMethod.Post, wsfeUrl);
            request.Headers.Add("SOAPAction", "http://ar.gov.afip.dif.FEV1/FEDummy");
            request.Content = new StringContent(soapBody, Encoding.UTF8, "text/xml");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return false;

            string responseContent = await response.Content.ReadAsStringAsync();
            
            // Should contain AppServer OK, DbServer OK, AuthServer OK
            return responseContent.Contains("OK");
        }

        public Task<(string PrivateKeyPem, string CsrPem)> GenerateCsrAsync(string cuit, string commonName)
        {
            using var rsa = RSA.Create(2048);
            
            var subjectName = new X500DistinguishedName($"CN={commonName}, O=PadelQ, C=AR, SERIALNUMBER=CUIT {cuit}");
            var request = new CertificateRequest(subjectName, rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            
            byte[] csrBytes = request.CreateSigningRequest();
            
            string privateKeyPem = new string(PemEncoding.Write("RSA PRIVATE KEY", rsa.ExportRSAPrivateKey()));
            string csrPem = new string(PemEncoding.Write("CERTIFICATE REQUEST", csrBytes));
            
            return Task.FromResult((privateKeyPem, csrPem));
        }

        public async Task<bool> RequestElectronicInvoiceAsync(Guid paymentGroupId)
        {
            var transactions = await _context.Transactions
                .Include(t => t.User)
                .Include(t => t.PaymentMethod)
                .Where(t => t.PaymentGroupId == paymentGroupId)
                .ToListAsync();

            if (!transactions.Any()) return false;

            // Check if any of the transactions require an invoice
            bool requiresInvoice = transactions.Any(t => t.PaymentMethod != null && t.PaymentMethod.InvoiceAutomatically);
            if (!requiresInvoice)
            {
                foreach (var tx in transactions) { tx.ArcaStatus = "No Requiere"; }
                await _context.SaveChangesAsync();
                return true;
            }

            var arcaSettings = await _context.Set<ArcaSetting>().FirstOrDefaultAsync();
            if (arcaSettings == null || string.IsNullOrEmpty(arcaSettings.CuitEmisor))
            {
                foreach (var tx in transactions) { tx.ArcaStatus = "Error: Falta CUIT Emisor"; }
                await _context.SaveChangesAsync();
                return false;
            }

            decimal totalAmount = transactions.Sum(t => t.Amount);
            decimal afipThreshold = arcaSettings.MontoMaximoAnonimo > 0 ? arcaSettings.MontoMaximoAnonimo : 344488m; // Dynamic threshold
            var user = transactions.FirstOrDefault(t => t.User != null)?.User;

            string docTipo = "99"; // Consumidor Final
            string docNro = "0";

            if (user != null)
            {
                if (!string.IsNullOrEmpty(user.Cuit))
                {
                    docTipo = "80"; // CUIT
                    docNro = user.Cuit.Replace("-", "");
                }
                else if (!string.IsNullOrEmpty(user.Dni))
                {
                    docTipo = "96"; // DNI
                    docNro = user.Dni.Replace(".", "");
                }
                else if (totalAmount >= afipThreshold)
                {
                    foreach (var tx in transactions) { tx.ArcaStatus = $"Error: Se requiere DNI para montos > ${afipThreshold}"; }
                    await _context.SaveChangesAsync();
                    return false;
                }
            }
            else if (totalAmount >= afipThreshold)
            {
                foreach (var tx in transactions) { tx.ArcaStatus = $"Error: Venta anónima excede tope de ${afipThreshold}"; }
                await _context.SaveChangesAsync();
                return false;
            }

            // Determine CbteTipo
            int cbteTipo = 6; // Factura B (Consumidor Final, Exento, etc)
            
            if (arcaSettings.CondicionIva == "Monotributo" || arcaSettings.CondicionIva == "Exento")
            {
                cbteTipo = 11; // Factura C (Monotributistas y Exentos siempre emiten C)
            }
            else if (arcaSettings.CondicionIva == "Responsable Inscripto")
            {
                if (user != null && docTipo == "80")
                {
                    // ARCA / AFIP (RG 5003/2021): RI issues Factura A to both RI and Monotributistas
                    if (user.IvaCondition == "Responsable Inscripto" || user.IvaCondition == "Monotributo")
                    {
                        cbteTipo = 1; // Factura A
                    }
                }
            }

            // Validate that Factura A has CUIT
            if (cbteTipo == 1 && docTipo != "80")
            {
                foreach (var tx in transactions) { tx.ArcaStatus = "Error: Factura A requiere CUIT válido"; }
                await _context.SaveChangesAsync();
                return false;
            }

            // Here we would build the XML and call the real WSFE SOAP endpoint using WSAA token.
            // For now, we simulate a successful AFIP response and stamp it on all transactions of the group.
            
            string dummyCae = "74" + new Random().Next(100000000, 999999999).ToString() + "123";
            DateTime caeExpiration = DateTime.UtcNow.AddDays(10);
            int dummyInvoiceNumber = new Random().Next(1000, 99999);

            foreach (var tx in transactions)
            {
                tx.Cae = dummyCae;
                tx.CaeExpiration = caeExpiration;
                tx.InvoiceNumber = dummyInvoiceNumber;
                tx.InvoiceType = cbteTipo;
                tx.ArcaStatus = "Aprobado";
            }

            await _context.SaveChangesAsync();
            return true;
        }
        public async Task<object> VerifyInvoiceWithAfipAsync(int transactionId)
        {
            var tx = await _context.Transactions
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Id == transactionId);

            if (tx == null || tx.InvoiceNumber == null || tx.InvoiceType == null)
                throw new Exception("Comprobante no válido para verificación.");

            var groupTransactions = await _context.Transactions
                .Where(t => t.PaymentGroupId == tx.PaymentGroupId)
                .ToListAsync();

            decimal totalAmount = groupTransactions.Sum(t => t.Amount);

            string docTipoName = "Consumidor Final";
            string docNro = "0";
            if (tx.User != null)
            {
                if (!string.IsNullOrEmpty(tx.User.Cuit))
                {
                    docTipoName = "CUIT";
                    docNro = tx.User.Cuit;
                }
                else if (!string.IsNullOrEmpty(tx.User.Dni))
                {
                    docTipoName = "DNI";
                    docNro = tx.User.Dni;
                }
            }

            string cbteTipoStr = tx.InvoiceType switch
            {
                1 => "Factura A",
                6 => "Factura B",
                11 => "Factura C",
                _ => $"Tipo {tx.InvoiceType}"
            };

            // Simulating network delay to AFIP WSFE
            await Task.Delay(500);

            return new
            {
                afipStatus = "Aprobado",
                afipCae = tx.Cae,
                afipVtoCae = tx.CaeExpiration?.ToString("dd/MM/yyyy") ?? "-",
                afipTotal = totalAmount,
                afipDate = tx.Date.ToString("dd/MM/yyyy HH:mm:ss"),
                afipPtoVta = 1, // Asumimos PtoVta 1 por ahora
                afipCbteNro = tx.InvoiceNumber,
                afipCbteTipoStr = cbteTipoStr,
                afipDocTipo = docTipoName,
                afipDocNro = docNro,
                afipClientName = tx.User?.FullName ?? "Consumidor Final",
                isMocked = true,
                message = "Verificación exitosa. (Modo Simulador de AFIP activo en el servidor)"
            };
        }
    }
}
