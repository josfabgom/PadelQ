using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ArcaAuditController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ArcaAuditController(ApplicationDbContext context)
        {
            _context = context;
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
    <div class='text-center'>IVA Responsable Inscripto</div>
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
