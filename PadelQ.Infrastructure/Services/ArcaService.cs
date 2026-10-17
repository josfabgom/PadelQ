using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;
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

        private static string GetWsaaUrl(bool isProduction) =>
            isProduction
                ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
                : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

        private static string GetWsfeUrl(bool isProduction) =>
            isProduction
                ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
                : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";

        public async Task<bool> TestConnectionAsync()
        {
            var setting = await _context.ArcaSettings.FirstOrDefaultAsync();
            if (setting == null) throw new Exception("Configuración de ARCA no encontrada");

            string wsfeUrl = GetWsfeUrl(setting.IsProduction);

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
            if (!responseContent.Contains("OK")) return false;

            // If certificate and private key are configured, also validate WSAA authentication
            if (!string.IsNullOrWhiteSpace(setting.CertificateCrtPem) && !string.IsNullOrWhiteSpace(setting.PrivateKeyPem))
            {
                await GetWsaaAuthAsync(setting);
            }

            return true;
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

        private async Task<(string Token, string Sign)> GetWsaaAuthAsync(ArcaSetting setting)
        {
            if (!string.IsNullOrWhiteSpace(setting.WsaaToken) &&
                !string.IsNullOrWhiteSpace(setting.WsaaSign) &&
                setting.WsaaExpiration.HasValue &&
                setting.WsaaExpiration.Value > DateTime.UtcNow.AddMinutes(5))
            {
                return (setting.WsaaToken, setting.WsaaSign);
            }

            if (string.IsNullOrWhiteSpace(setting.CertificateCrtPem) || string.IsNullOrWhiteSpace(setting.PrivateKeyPem))
            {
                throw new Exception("Falta el Certificado (.crt) o la Clave Privada (.key) en la configuración de ARCA.");
            }

            var arOffset = TimeSpan.FromHours(-3);
            var nowAr = DateTimeOffset.UtcNow.ToOffset(arOffset);
            var genTime = nowAr.AddMinutes(-10);
            var expTime = nowAr.AddHours(11);
            uint uniqueId = (uint)(DateTimeOffset.UtcNow.ToUnixTimeSeconds() & 0xFFFFFFFF);

            string traXml = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<loginTicketRequest version=""1.0"">
  <header>
    <uniqueId>{uniqueId}</uniqueId>
    <generationTime>{genTime:yyyy-MM-ddTHH:mm:sszzz}</generationTime>
    <expirationTime>{expTime:yyyy-MM-ddTHH:mm:sszzz}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>";

            using var certWithKey = X509Certificate2.CreateFromPem(setting.CertificateCrtPem, setting.PrivateKeyPem);
            byte[] pfxBytes = certWithKey.Export(X509ContentType.Pfx);
            using var signingCert = new X509Certificate2(pfxBytes, (string?)null, X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);

            var contentInfo = new ContentInfo(Encoding.UTF8.GetBytes(traXml));
            var signedCms = new SignedCms(contentInfo);
            var cmsSigner = new CmsSigner(SubjectIdentifierType.IssuerAndSerialNumber, signingCert)
            {
                IncludeOption = X509IncludeOption.EndCertOnly
            };
            signedCms.ComputeSignature(cmsSigner);
            string cmsBase64 = Convert.ToBase64String(signedCms.Encode());

            string soapEnvelope = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soapenv:Envelope xmlns:soapenv=""http://schemas.xmlsoap.org/soap/envelope/"" xmlns:wsaa=""http://wsaa.view.sua.dvadac.desein.afip.gov"">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>{cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>";

            string wsaaUrl = GetWsaaUrl(setting.IsProduction);
            var req = new HttpRequestMessage(HttpMethod.Post, wsaaUrl);
            req.Headers.Add("SOAPAction", "");
            req.Content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");

            var resp = await _httpClient.SendAsync(req);
            string respXml = await resp.Content.ReadAsStringAsync();

            var soapDoc = XDocument.Parse(respXml);
            var faultString = soapDoc.Descendants().FirstOrDefault(e => e.Name.LocalName == "faultstring")?.Value;
            if (!string.IsNullOrEmpty(faultString))
            {
                throw new Exception($"WSAA AFIP rechazó la autenticación: {faultString}");
            }

            var loginReturn = soapDoc.Descendants().FirstOrDefault(e => e.Name.LocalName == "loginCmsReturn")?.Value;
            if (string.IsNullOrEmpty(loginReturn))
            {
                throw new Exception("Respuesta vacía de WSAA AFIP al solicitar Ticket de Acceso.");
            }

            var taDoc = XDocument.Parse(loginReturn);
            string? token = taDoc.Descendants().FirstOrDefault(e => e.Name.LocalName == "token")?.Value;
            string? sign = taDoc.Descendants().FirstOrDefault(e => e.Name.LocalName == "sign")?.Value;
            string? expStr = taDoc.Descendants().FirstOrDefault(e => e.Name.LocalName == "expirationTime")?.Value;

            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(sign))
            {
                throw new Exception("WSAA AFIP no devolvió Token o Sign válidos.");
            }

            DateTime expirationUtc = DateTime.UtcNow.AddHours(11);
            if (!string.IsNullOrEmpty(expStr) && DateTimeOffset.TryParse(expStr, out var dto))
            {
                expirationUtc = dto.UtcDateTime;
            }

            setting.WsaaToken = token;
            setting.WsaaSign = sign;
            setting.WsaaExpiration = expirationUtc;
            await _context.SaveChangesAsync();

            return (token, sign);
        }

        private async Task<int> GetLastAuthorizedInvoiceNumberAsync(string wsfeUrl, string token, string sign, string cuitEmisor, int ptoVta, int cbteTipo)
        {
            string soapBody = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance"" xmlns:xsd=""http://www.w3.org/2001/XMLSchema"" xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <FECompUltimoAutorizado xmlns=""http://ar.gov.afip.dif.FEV1/"">
      <Auth>
        <Token>{SecurityElement.Escape(token)}</Token>
        <Sign>{SecurityElement.Escape(sign)}</Sign>
        <Cuit>{cuitEmisor}</Cuit>
      </Auth>
      <PtoVta>{ptoVta}</PtoVta>
      <CbteTipo>{cbteTipo}</CbteTipo>
    </FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>";

            var req = new HttpRequestMessage(HttpMethod.Post, wsfeUrl);
            req.Headers.Add("SOAPAction", "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado");
            req.Content = new StringContent(soapBody, Encoding.UTF8, "text/xml");

            var resp = await _httpClient.SendAsync(req);
            string respXml = await resp.Content.ReadAsStringAsync();

            var doc = XDocument.Parse(respXml);
            var errElements = doc.Descendants().Where(e => e.Name.LocalName == "Err").ToList();
            if (errElements.Any())
            {
                var msgs = errElements.Select(e =>
                    $"({e.Elements().FirstOrDefault(x => x.Name.LocalName == "Code")?.Value}) {e.Elements().FirstOrDefault(x => x.Name.LocalName == "Msg")?.Value}");
                throw new Exception($"Error AFIP al consultar último comprobante (PtoVta {ptoVta}): {string.Join(" | ", msgs)}");
            }

            string? cbteNroStr = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "CbteNro")?.Value;
            if (int.TryParse(cbteNroStr, out int lastCbteNro))
            {
                return lastCbteNro;
            }

            return 0;
        }

        public async Task<bool> RequestElectronicInvoiceAsync(Guid paymentGroupId)
        {
            var transactions = await _context.Transactions
                .Include(t => t.User)
                .Include(t => t.PaymentMethod)
                .Where(t => t.PaymentGroupId == paymentGroupId)
                .ToListAsync();

            if (!transactions.Any()) return false;

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

            decimal totalAmount = Math.Round(transactions.Sum(t => t.Amount), 2);
            decimal afipThreshold = arcaSettings.MontoMaximoAnonimo > 0 ? arcaSettings.MontoMaximoAnonimo : 344488m;
            var user = transactions.FirstOrDefault(t => t.User != null)?.User;

            string docTipo = "99"; // Consumidor Final
            string docNro = "0";

            if (user != null)
            {
                if (!string.IsNullOrEmpty(user.Cuit))
                {
                    docTipo = "80"; // CUIT
                    docNro = new string(user.Cuit.Where(char.IsDigit).ToArray());
                }
                else if (!string.IsNullOrEmpty(user.Dni))
                {
                    docTipo = "96"; // DNI
                    docNro = new string(user.Dni.Where(char.IsDigit).ToArray());
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

            if (string.IsNullOrEmpty(docNro) || docNro == "0")
            {
                docTipo = "99";
                docNro = "0";
            }

            // Determine CbteTipo
            int cbteTipo = 6; // Factura B (Consumidor Final, Exento, etc)

            if (arcaSettings.CondicionIva == "Monotributo" || arcaSettings.CondicionIva == "Exento")
            {
                cbteTipo = 11; // Factura C
            }
            else if (arcaSettings.CondicionIva == "Responsable Inscripto")
            {
                if (user != null && docTipo == "80")
                {
                    if (user.IvaCondition == "Responsable Inscripto" || user.IvaCondition == "Monotributo")
                    {
                        cbteTipo = 1; // Factura A
                    }
                }
            }

            if (cbteTipo == 1 && docTipo != "80")
            {
                foreach (var tx in transactions) { tx.ArcaStatus = "Error: Factura A requiere CUIT válido"; }
                await _context.SaveChangesAsync();
                return false;
            }

            // Determine CondicionIVAReceptorId (RG 5616)
            int condicionIvaReceptorId = 5; // Consumidor Final
            if (cbteTipo == 1)
            {
                condicionIvaReceptorId = user?.IvaCondition == "Monotributo" ? 6 : 1;
            }
            else if (user?.IvaCondition == "Exento")
            {
                condicionIvaReceptorId = 4; // IVA Sujeto Exento
            }

            int ptoVta = arcaSettings.PuntoDeVenta > 0 ? arcaSettings.PuntoDeVenta : 1;
            string cuitEmisor = new string(arcaSettings.CuitEmisor.Where(char.IsDigit).ToArray());
            string wsfeUrl = GetWsfeUrl(arcaSettings.IsProduction);

            try
            {
                var (token, sign) = await GetWsaaAuthAsync(arcaSettings);
                int lastCbteNro = await GetLastAuthorizedInvoiceNumberAsync(wsfeUrl, token, sign, cuitEmisor, ptoVta, cbteTipo);
                int nextCbteNro = lastCbteNro + 1;

                string cbteFch = DateTime.UtcNow.AddHours(-3).ToString("yyyyMMdd");

                decimal impTotal = totalAmount;
                decimal impNeto;
                decimal impIva;
                string ivaXmlBlock = "";

                if (cbteTipo == 11)
                {
                    // Factura C does not discriminate IVA
                    impNeto = impTotal;
                    impIva = 0m;
                }
                else
                {
                    // Factura A or B (21% IVA)
                    impNeto = Math.Round(impTotal / 1.21m, 2);
                    impIva = Math.Round(impTotal - impNeto, 2);
                    ivaXmlBlock = $@"
            <Iva>
              <AlicIva>
                <Id>5</Id>
                <BaseImp>{impNeto.ToString("0.00", CultureInfo.InvariantCulture)}</BaseImp>
                <Importe>{impIva.ToString("0.00", CultureInfo.InvariantCulture)}</Importe>
              </AlicIva>
            </Iva>";
                }

                string fecaeSoap = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance"" xmlns:xsd=""http://www.w3.org/2001/XMLSchema"" xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <FECAESolicitar xmlns=""http://ar.gov.afip.dif.FEV1/"">
      <Auth>
        <Token>{SecurityElement.Escape(token)}</Token>
        <Sign>{SecurityElement.Escape(sign)}</Sign>
        <Cuit>{cuitEmisor}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>{ptoVta}</PtoVta>
          <CbteTipo>{cbteTipo}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>{docTipo}</DocTipo>
            <DocNro>{docNro}</DocNro>
            <CbteDesde>{nextCbteNro}</CbteDesde>
            <CbteHasta>{nextCbteNro}</CbteHasta>
            <CbteFch>{cbteFch}</CbteFch>
            <ImpTotal>{impTotal.ToString("0.00", CultureInfo.InvariantCulture)}</ImpTotal>
            <ImpTotConc>0.00</ImpTotConc>
            <ImpNeto>{impNeto.ToString("0.00", CultureInfo.InvariantCulture)}</ImpNeto>
            <ImpOpEx>0.00</ImpOpEx>
            <ImpTrib>0.00</ImpTrib>
            <ImpIVA>{impIva.ToString("0.00", CultureInfo.InvariantCulture)}</ImpIVA>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            <CondicionIVAReceptorId>{condicionIvaReceptorId}</CondicionIVAReceptorId>{ivaXmlBlock}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>";

                var req = new HttpRequestMessage(HttpMethod.Post, wsfeUrl);
                req.Headers.Add("SOAPAction", "http://ar.gov.afip.dif.FEV1/FECAESolicitar");
                req.Content = new StringContent(fecaeSoap, Encoding.UTF8, "text/xml");

                var resp = await _httpClient.SendAsync(req);
                string respXml = await resp.Content.ReadAsStringAsync();

                var doc = XDocument.Parse(respXml);
                var detResp = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "FECAEDetResponse");
                string? resultado = detResp?.Elements().FirstOrDefault(e => e.Name.LocalName == "Resultado")?.Value
                                    ?? doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Resultado")?.Value;
                string? cae = detResp?.Elements().FirstOrDefault(e => e.Name.LocalName == "CAE")?.Value;
                string? caeFchVtoStr = detResp?.Elements().FirstOrDefault(e => e.Name.LocalName == "CAEFchVto")?.Value;

                if (resultado == "A" && !string.IsNullOrEmpty(cae))
                {
                    DateTime caeExpiration = DateTime.UtcNow.AddDays(10);
                    if (!string.IsNullOrEmpty(caeFchVtoStr) &&
                        DateTime.TryParseExact(caeFchVtoStr, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedVto))
                    {
                        caeExpiration = parsedVto;
                    }

                    foreach (var tx in transactions)
                    {
                        tx.Cae = cae;
                        tx.CaeExpiration = caeExpiration;
                        tx.InvoiceNumber = nextCbteNro;
                        tx.InvoiceType = cbteTipo;
                        tx.ArcaStatus = "Aprobado";
                    }

                    await _context.SaveChangesAsync();
                    return true;
                }
                else
                {
                    var messages = new List<string>();
                    foreach (var err in doc.Descendants().Where(e => e.Name.LocalName == "Err" || e.Name.LocalName == "Obs"))
                    {
                        string? code = err.Elements().FirstOrDefault(x => x.Name.LocalName == "Code")?.Value;
                        string? msg = err.Elements().FirstOrDefault(x => x.Name.LocalName == "Msg")?.Value;
                        if (!string.IsNullOrEmpty(msg))
                        {
                            messages.Add($"({code}) {msg}");
                        }
                    }

                    string fullError = messages.Any() ? string.Join(" | ", messages) : "Rechazado por AFIP sin detalle.";
                    string statusText = $"Error AFIP: {fullError}";
                    if (statusText.Length > 250) statusText = statusText.Substring(0, 250);

                    foreach (var tx in transactions)
                    {
                        tx.Cae = null;
                        tx.CaeExpiration = null;
                        tx.InvoiceNumber = null;
                        tx.ArcaStatus = statusText;
                    }

                    await _context.SaveChangesAsync();
                    return false;
                }
            }
            catch (Exception ex)
            {
                string statusText = $"Error: {ex.Message}";
                if (statusText.Length > 250) statusText = statusText.Substring(0, 250);

                foreach (var tx in transactions)
                {
                    tx.Cae = null;
                    tx.CaeExpiration = null;
                    tx.InvoiceNumber = null;
                    tx.ArcaStatus = statusText;
                }

                await _context.SaveChangesAsync();
                return false;
            }
        }

        public async Task<object> VerifyInvoiceWithAfipAsync(int transactionId)
        {
            var tx = await _context.Transactions
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Id == transactionId);

            if (tx == null || tx.InvoiceNumber == null || tx.InvoiceType == null)
                throw new Exception("Comprobante no válido para verificación.");

            var arcaSettings = await _context.Set<ArcaSetting>().FirstOrDefaultAsync();
            if (arcaSettings == null || string.IsNullOrEmpty(arcaSettings.CuitEmisor))
                throw new Exception("Configuración de ARCA no encontrada.");

            int ptoVta = arcaSettings.PuntoDeVenta > 0 ? arcaSettings.PuntoDeVenta : 1;
            string cuitEmisor = new string(arcaSettings.CuitEmisor.Where(char.IsDigit).ToArray());
            string wsfeUrl = GetWsfeUrl(arcaSettings.IsProduction);

            var (token, sign) = await GetWsaaAuthAsync(arcaSettings);

            string soapBody = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance"" xmlns:xsd=""http://www.w3.org/2001/XMLSchema"" xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <FECompConsultar xmlns=""http://ar.gov.afip.dif.FEV1/"">
      <Auth>
        <Token>{SecurityElement.Escape(token)}</Token>
        <Sign>{SecurityElement.Escape(sign)}</Sign>
        <Cuit>{cuitEmisor}</Cuit>
      </Auth>
      <FeCompConsReq>
        <CbteTipo>{tx.InvoiceType.Value}</CbteTipo>
        <CbteNro>{tx.InvoiceNumber.Value}</CbteNro>
        <PtoVta>{ptoVta}</PtoVta>
      </FeCompConsReq>
    </FECompConsultar>
  </soap:Body>
</soap:Envelope>";

            var req = new HttpRequestMessage(HttpMethod.Post, wsfeUrl);
            req.Headers.Add("SOAPAction", "http://ar.gov.afip.dif.FEV1/FECompConsultar");
            req.Content = new StringContent(soapBody, Encoding.UTF8, "text/xml");

            var resp = await _httpClient.SendAsync(req);
            string respXml = await resp.Content.ReadAsStringAsync();

            var doc = XDocument.Parse(respXml);
            var resultGet = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "ResultGet");

            if (resultGet == null)
            {
                var errs = doc.Descendants().Where(e => e.Name.LocalName == "Err")
                    .Select(e => $"({e.Elements().FirstOrDefault(x => x.Name.LocalName == "Code")?.Value}) {e.Elements().FirstOrDefault(x => x.Name.LocalName == "Msg")?.Value}")
                    .ToList();
                string errMsg = errs.Any() ? string.Join(" | ", errs) : "El comprobante no existe en los registros de AFIP.";
                throw new Exception($"AFIP informó: {errMsg}");
            }

            string? resultado = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "Resultado")?.Value;
            string? codAut = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "CodAutorizacion")?.Value;
            string? fchVto = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "FchVto")?.Value;
            string? impTotalStr = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "ImpTotal")?.Value;
            string? cbteFchStr = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "CbteFch")?.Value;
            string? ptoVtaStr = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "PtoVta")?.Value;
            string? cbteDesdeStr = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "CbteDesde")?.Value;
            string? docTipoStr = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "DocTipo")?.Value;
            string? docNroStr = resultGet.Elements().FirstOrDefault(e => e.Name.LocalName == "DocNro")?.Value;

            string formattedVto = fchVto ?? "-";
            if (!string.IsNullOrEmpty(fchVto) && DateTime.TryParseExact(fchVto, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var vtoDate))
            {
                formattedVto = vtoDate.ToString("dd/MM/yyyy");
            }

            string formattedDate = tx.Date.ToString("dd/MM/yyyy HH:mm:ss");
            if (!string.IsNullOrEmpty(cbteFchStr) && DateTime.TryParseExact(cbteFchStr, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var cbteDate))
            {
                formattedDate = cbteDate.ToString("dd/MM/yyyy");
            }

            decimal impTotal = tx.Amount;
            if (!string.IsNullOrEmpty(impTotalStr))
            {
                decimal.TryParse(impTotalStr, NumberStyles.Any, CultureInfo.InvariantCulture, out impTotal);
            }

            string docTipoName = docTipoStr switch
            {
                "80" => "CUIT",
                "96" => "DNI",
                _ => "Consumidor Final"
            };

            string cbteTipoStr = tx.InvoiceType switch
            {
                1 => "Factura A",
                6 => "Factura B",
                11 => "Factura C",
                _ => $"Tipo {tx.InvoiceType}"
            };

            int afipPtoVta = int.TryParse(ptoVtaStr, out int parsedPtoVta) ? parsedPtoVta : ptoVta;
            long afipCbteNro = long.TryParse(cbteDesdeStr, out long parsedCbteNro) ? parsedCbteNro : tx.InvoiceNumber.Value;

            return new
            {
                afipStatus = resultado == "A" ? "Aprobado" : (resultado ?? "Desconocido"),
                afipCae = codAut ?? tx.Cae,
                afipVtoCae = formattedVto,
                afipTotal = impTotal,
                afipDate = formattedDate,
                afipPtoVta = afipPtoVta,
                afipCbteNro = afipCbteNro,
                afipCbteTipoStr = cbteTipoStr,
                afipDocTipo = docTipoName,
                afipDocNro = docNroStr ?? "0",
                afipClientName = tx.User?.FullName ?? "Consumidor Final",
                isMocked = false,
                message = $"Comprobante verificado en tiempo real en los servidores de ARCA/AFIP ({(arcaSettings.IsProduction ? "Producción" : "Homologación")} - Pto. Venta {afipPtoVta:D5})."
            };
        }
    }
}
