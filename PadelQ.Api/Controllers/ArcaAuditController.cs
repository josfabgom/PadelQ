using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Linq;
using System.Threading.Tasks;

using PadelQ.Application.Common.Interfaces;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ArcaAuditController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IArcaService _arcaService;

        public ArcaAuditController(ApplicationDbContext context, IArcaService arcaService)
        {
            _context = context;
            _arcaService = arcaService;
        }

        [HttpGet]
        public async Task<IActionResult> GetInvoices()
        {
            var rawTransactions = await _context.Transactions
                .Include(t => t.User)
                .OrderByDescending(t => t.Date)
                .Take(400)
                .ToListAsync();

            var grouped = rawTransactions
                .GroupBy(t => t.PaymentGroupId)
                .Select(g => new
                {
                    Id = g.First().Id,
                    Date = g.First().Date,
                    Amount = g.Sum(t => t.Amount),
                    UserName = g.First().User != null ? g.First().User.FullName : "Consumidor Final",
                    Type = g.First().Type,
                    Description = string.Join(" + ", g.Select(t => t.Description)),
                    ArcaStatus = g.First().ArcaStatus,
                    Cae = g.First().Cae,
                    InvoiceNumber = g.First().InvoiceNumber,
                    InvoiceType = g.First().InvoiceType
                })
                .OrderByDescending(g => g.Date)
                .Take(100)
                .ToList();

            return Ok(grouped);
        }

        [HttpPost("{id}/retry")]
        public async Task<IActionResult> RetryInvoice(int id)
        {
            var refTx = await _context.Transactions.FindAsync(id);
            if (refTx == null) return NotFound();

            var transactions = await _context.Transactions
                .Where(t => t.PaymentGroupId == refTx.PaymentGroupId)
                .ToListAsync();

            foreach(var tx in transactions) {
                tx.ArcaStatus = "Pendiente";
            }
            await _context.SaveChangesAsync();

            return Ok();
        }

        [HttpGet("{id}/verify")]
        public async Task<IActionResult> VerifyInvoice(int id)
        {
            try
            {
                var result = await _arcaService.VerifyInvoiceWithAfipAsync(id);
                return Ok(result);
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("export-iva")]
        public async Task<IActionResult> ExportLibroIva([FromQuery] int year, [FromQuery] int month)
        {
            var transactions = await _context.Transactions
                .Include(t => t.User)
                .Where(t => t.ArcaStatus == "Aprobado" && t.Date.Year == year && t.Date.Month == month)
                .ToListAsync();

            var grouped = transactions
                .GroupBy(t => t.PaymentGroupId)
                .Select(g =>
                {
                    var first = g.First();
                    decimal totalAmount = g.Sum(t => t.Amount);
                    
                    string docTipo = "Consumidor Final";
                    string docNro = "0";
                    if (first.User != null)
                    {
                        if (!string.IsNullOrEmpty(first.User.Cuit))
                        {
                            docTipo = "CUIT";
                            docNro = first.User.Cuit;
                        }
                        else if (!string.IsNullOrEmpty(first.User.Dni))
                        {
                            docTipo = "DNI";
                            docNro = first.User.Dni;
                        }
                    }

                    string cbteTipoStr = first.InvoiceType switch
                    {
                        1 => "Factura A",
                        6 => "Factura B",
                        11 => "Factura C",
                        _ => $"Tipo {first.InvoiceType}"
                    };

                    return new
                    {
                        Fecha = first.Date.ToString("dd/MM/yyyy"),
                        TipoComprobante = cbteTipoStr,
                        PuntoVenta = "00001",
                        NumeroComprobante = first.InvoiceNumber?.ToString("D8") ?? "",
                        TipoDocumento = docTipo,
                        NumeroDocumento = docNro,
                        Cliente = first.User?.FullName ?? "Consumidor Final",
                        ImporteTotal = totalAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                        CAE = first.Cae ?? ""
                    };
                })
                .OrderBy(x => x.Fecha).ThenBy(x => x.NumeroComprobante)
                .ToList();

            var csvBuilder = new System.Text.StringBuilder();
            csvBuilder.AppendLine("Fecha,Tipo Comprobante,Punto de Venta,Nro Comprobante,Doc Tipo,Doc Nro,Cliente,Importe Total,CAE");

            foreach (var item in grouped)
            {
                string clientSafe = item.Cliente.Contains(",") ? $"\"{item.Cliente}\"" : item.Cliente;
                csvBuilder.AppendLine($"{item.Fecha},{item.TipoComprobante},{item.PuntoVenta},{item.NumeroComprobante},{item.TipoDocumento},{item.NumeroDocumento},{clientSafe},{item.ImporteTotal},{item.CAE}");
            }

            var bytes = System.Text.Encoding.UTF8.GetBytes(csvBuilder.ToString());
            var bytesWithBom = new byte[bytes.Length + 3];
            bytesWithBom[0] = 0xEF;
            bytesWithBom[1] = 0xBB;
            bytesWithBom[2] = 0xBF;
            System.Array.Copy(bytes, 0, bytesWithBom, 3, bytes.Length);

            string fileName = $"Libro_IVA_Ventas_{month:D2}_{year}.csv";
            return File(bytesWithBom, "text/csv", fileName);
        }

        [HttpGet("{id}/print")]
        public async Task<IActionResult> PrintInvoice(int id)
        {
            var refTx = await _context.Transactions.FindAsync(id);
            if (refTx == null) return NotFound();

            var transactions = await _context.Transactions
                .Include(t => t.User)
                .Where(t => t.PaymentGroupId == refTx.PaymentGroupId)
                .ToListAsync();

            var transaction = transactions.FirstOrDefault();
            
            if (transaction == null || transaction.ArcaStatus != "Aprobado") 
                return NotFound("Comprobante no encontrado o no aprobado.");

            var settings = await _context.ArcaSettings.FirstOrDefaultAsync();
            string companyName = "PadelQ";
            string cuit = settings?.CuitEmisor ?? "00000000000";
            
            string invoiceTypeStr = transaction.InvoiceType switch
            {
                1 => "A",
                6 => "B",
                11 => "C",
                _ => "X"
            };

            string clientName = transaction.User?.FullName ?? "Consumidor Final";
            string clientDoc = !string.IsNullOrEmpty(transaction.User?.Cuit) ? $"CUIT: {transaction.User.Cuit}" :
                               (!string.IsNullOrEmpty(transaction.User?.Dni) ? $"DNI: {transaction.User.Dni}" : "");

            decimal totalAmount = transactions.Sum(t => t.Amount);

            string afipJson = $@"{{
  ""ver"": 1,
  ""fecha"": ""{transaction.Date:yyyy-MM-dd}"",
  ""cuit"": {long.Parse(cuit.Replace("-", "").PadRight(11, '0'))},
  ""ptoVta"": 1,
  ""tipoCmp"": {transaction.InvoiceType},
  ""nroCmp"": {transaction.InvoiceNumber},
  ""importe"": {totalAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)},
  ""moneda"": ""PES"",
  ""ctz"": 1,
  ""tipoDocRec"": 99,
  ""nroDocRec"": 0,
  ""tipoCodAut"": ""E"",
  ""codAut"": {transaction.Cae ?? "0"}
}}";
            string base64Json = System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(afipJson));
            string afipUrl = "https://www.afip.gob.ar/fe/qr/?p=" + base64Json;

            string itemsHtml = "";
            foreach(var tx in transactions)
            {
                itemsHtml += $@"
    <div class='row'>
        <span style='flex:1; padding-right:10px;'>{tx.Description}</span>
        <span>${tx.Amount:N2}</span>
    </div>";
            }

            string ivaConditionStr = settings?.CondicionIva ?? "Responsable Inscripto";

            string html = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Comprobante {invoiceTypeStr} - {transaction.InvoiceNumber:D8}</title>
    <style>
        body {{ font-family: 'Courier New', Courier, monospace; margin: 20px; font-size: 14px; max-width: 350px; }}
        h1, h2, h3 {{ text-align: center; margin: 5px 0; }}
        .divider {{ border-top: 1px dashed #000; margin: 15px 0; }}
        .row {{ display: flex; justify-content: space-between; margin-bottom: 5px; }}
        .text-center {{ text-align: center; }}
        .bold {{ font-weight: bold; }}
    </style>
</head>
<body onload='setTimeout(function() {{ window.print(); }}, 500)'>
    <h2>{companyName}</h2>
    <div class='text-center'>CUIT: {cuit}</div>
    <div class='text-center'>IVA {ivaConditionStr}</div>
    <div class='divider'></div>
    
    <div class='text-center bold'>FACTURA ""{invoiceTypeStr}""</div>
    <div class='text-center'>Nro: {transaction.InvoiceNumber:D8}</div>
    <div class='text-center'>Fecha: {transaction.Date.ToString("dd/MM/yyyy HH:mm")}</div>
    <div class='divider'></div>

    <div>Cliente: {clientName}</div>
    <div>{clientDoc}</div>
    <div class='divider'></div>

    <div class='row bold'>
        <span>Descripción</span>
        <span>Total</span>
    </div>
    {itemsHtml}
    
    <div class='divider'></div>
    <div class='row bold' style='font-size: 18px;'>
        <span>TOTAL:</span>
        <span>${totalAmount:N2}</span>
    </div>
    <div class='divider'></div>

    <div class='text-center bold'>CAE: {transaction.Cae}</div>
    <div class='text-center'>Vto CAE: {transaction.CaeExpiration?.ToString("dd/MM/yyyy") ?? "-"}</div>
    
    <div style='margin-top: 20px; text-align: center;'>
        <div id='qrcode' style='display: flex; justify-content: center; margin-bottom: 10px;'></div>
        <div style='font-size: 10px; font-weight: bold;'>Comprobante Autorizado por AFIP</div>
    </div>
    
    <script src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'></script>
    <script>
        new QRCode(document.getElementById('qrcode'), {{
            text: '{afipUrl}',
            width: 140,
            height: 140
        }});
    </script>
</body>
</html>";

            return Content(html, "text/html", System.Text.Encoding.UTF8);
        }
    }
}
