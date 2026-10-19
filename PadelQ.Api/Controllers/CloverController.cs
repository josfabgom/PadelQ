using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CloverController : ControllerBase
    {
        private readonly ICloverService _cloverService;
        private readonly PadelQ.Infrastructure.Persistence.ApplicationDbContext _context;

        public CloverController(ICloverService cloverService, PadelQ.Infrastructure.Persistence.ApplicationDbContext context)
        {
            _cloverService = cloverService;
            _context = context;
        }

        [HttpGet("settings")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetSettings()
        {
            var settings = await _context.CloverSettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                settings = new CloverSetting();
                _context.CloverSettings.Add(settings);
                await _context.SaveChangesAsync();
            }
            return Ok(settings);
        }

        [HttpPost("settings")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSettings([FromBody] CloverSetting updatedSettings)
        {
            var settings = await _context.CloverSettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                _context.CloverSettings.Add(updatedSettings);
            }
            else
            {
                settings.IsProduction = updatedSettings.IsProduction;
                settings.MerchantId = updatedSettings.MerchantId?.Trim() ?? string.Empty;
                settings.AccessToken = updatedSettings.AccessToken?.Trim() ?? string.Empty;
                settings.AppId = updatedSettings.AppId;
                settings.AppSecret = updatedSettings.AppSecret;
                settings.UpdatedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();
            return Ok(settings);
        }

        [HttpPost("charge")]
        public async Task<IActionResult> Charge([FromBody] CloverChargeRequest request)
        {
            try
            {
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                var deviceId = user?.CloverDeviceId;

                if (!string.IsNullOrWhiteSpace(request.DeviceId))
                    deviceId = request.DeviceId.Trim();

                if (string.IsNullOrWhiteSpace(deviceId))
                {
                    deviceId = await _context.Users
                        .Where(u => u.CloverDeviceId != null && u.CloverDeviceId != "")
                        .Select(u => u.CloverDeviceId)
                        .FirstOrDefaultAsync();
                }

                int auditId = await _cloverService.InitiatePaymentOnDeviceAsync(
                    request.Amount,
                    request.OrderId,
                    deviceId ?? string.Empty,
                    string.IsNullOrWhiteSpace(request.SourceModule) ? "Cobro POS" : request.SourceModule,
                    request.ClientName,
                    request.Description,
                    user?.Email ?? user?.UserName ?? "Operador");

                if (auditId > 0)
                {
                    var audit = await _context.CloverPaymentAudits.FindAsync(auditId);
                    return Ok(new
                    {
                        auditId = auditId,
                        externalPaymentId = audit?.ExternalPaymentId,
                        status = audit?.Status ?? "PENDING",
                        Message = "Cobro enviado exitosamente al dispositivo Clover."
                    });
                }

                return BadRequest("Error al enviar el cobro a Clover.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("audit/{id}/status")]
        public async Task<IActionResult> GetAuditStatus(int id, [FromQuery] bool forceVerify = false)
        {
            var audit = await _context.CloverPaymentAudits.FirstOrDefaultAsync(a => a.Id == id);
            if (audit == null) return NotFound();

            if (audit.Status == "PENDING" &&
                (forceVerify || (PadelQ.Domain.TimeZoneHelper.GetArgNow() - audit.CreatedAt).TotalSeconds >= 4))
            {
                try
                {
                    await _cloverService.VerifyPaymentWithCloverAsync(id);
                    audit = await _context.CloverPaymentAudits.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id) ?? audit;
                }
                catch
                {
                    // Si falla la consulta REST puntual, devolvemos el estado actual sin interrumpir el polling
                }
            }

            return Ok(new
            {
                id = audit.Id,
                status = audit.Status,
                statusDetail = audit.StatusDetail,
                cloverPaymentId = audit.CloverPaymentId,
                externalPaymentId = audit.ExternalPaymentId,
                cardBrand = audit.CardBrand,
                cardLast4 = audit.CardLast4,
                authCode = audit.AuthCode,
                entryType = audit.EntryType,
                amount = audit.Amount,
                completedAt = audit.CompletedAt
            });
        }

        [HttpPost("audit/{id}/cancel")]
        public async Task<IActionResult> CancelAuditPayment(int id)
        {
            var ok = await _cloverService.CancelPaymentOnDeviceAsync(id);
            if (!ok) return NotFound();

            var audit = await _context.CloverPaymentAudits.FirstOrDefaultAsync(a => a.Id == id);
            if (audit != null && audit.Status == "APPROVED")
            {
                return Ok(new
                {
                    status = "APPROVED",
                    approved = true,
                    auditId = audit.Id,
                    cloverPaymentId = audit.CloverPaymentId,
                    externalPaymentId = audit.ExternalPaymentId,
                    cardBrand = audit.CardBrand,
                    cardLast4 = audit.CardLast4,
                    authCode = audit.AuthCode,
                    message = "El cobro ya había sido aprobado exitosamente en la terminal Clover."
                });
            }

            return Ok(new { status = "CANCELLED", message = "Cobro cancelado en la terminal Clover." });
        }

        [HttpPost("audit/{id}/link")]
        public async Task<IActionResult> LinkAuditTransaction(int id, [FromBody] LinkCloverTransactionRequest request)
        {
            var audit = await _context.CloverPaymentAudits.FirstOrDefaultAsync(a => a.Id == id);
            if (audit == null) return NotFound();

            if (request.PaymentGroupId.HasValue)
            {
                audit.PaymentGroupId = request.PaymentGroupId.Value;
            }
            else
            {
                // Si no se pasó PaymentGroupId explícito, buscar la última transacción Clover creada en los últimos 2 minutos
                var recentCloverTx = await _context.Transactions
                    .Include(t => t.PaymentMethod)
                    .Where(t => t.Date >= audit.CreatedAt.AddMinutes(-2) &&
                                t.PaymentMethod != null &&
                                t.PaymentMethod.Name.ToUpper().Contains("CLOVER"))
                    .OrderByDescending(t => t.Date)
                    .FirstOrDefaultAsync();

                if (recentCloverTx?.PaymentGroupId != null)
                {
                    audit.PaymentGroupId = recentCloverTx.PaymentGroupId;
                }
            }

            if (!string.IsNullOrWhiteSpace(request.ClientName))
                audit.ClientName = request.ClientName;
            if (!string.IsNullOrWhiteSpace(request.Description))
                audit.Description = request.Description;

            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpGet("audit")]
        public async Task<IActionResult> GetAudits([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] string? status)
        {
            var arcaSettings = await _context.ArcaSettings.FirstOrDefaultAsync();
            int ptoVta = arcaSettings != null && arcaSettings.PuntoDeVenta > 0 ? arcaSettings.PuntoDeVenta : 3;

            var query = _context.CloverPaymentAudits.AsQueryable();

            if (startDate.HasValue)
            {
                var start = startDate.Value.Date;
                query = query.Where(a => a.CreatedAt >= start);
            }

            if (endDate.HasValue)
            {
                var end = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(a => a.CreatedAt <= end);
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
            {
                query = query.Where(a => a.Status == status);
            }

            var audits = await query
                .OrderByDescending(a => a.CreatedAt)
                .Take(300)
                .ToListAsync();

            var groupIds = audits
                .Where(a => a.PaymentGroupId.HasValue)
                .Select(a => a.PaymentGroupId!.Value)
                .Distinct()
                .ToList();

            var relatedTxs = await _context.Transactions
                .Include(t => t.User)
                .Where(t => t.PaymentGroupId.HasValue && groupIds.Contains(t.PaymentGroupId.Value))
                .ToListAsync();

            var txByGroup = relatedTxs
                .GroupBy(t => t.PaymentGroupId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = audits.Select(a =>
            {
                List<Transaction>? groupTxs = null;
                if (a.PaymentGroupId.HasValue)
                {
                    txByGroup.TryGetValue(a.PaymentGroupId.Value, out groupTxs);
                }

                var firstTx = groupTxs?.FirstOrDefault();
                string? txDescription = groupTxs != null && groupTxs.Any()
                    ? string.Join(" + ", groupTxs.Select(t => t.Description).Where(d => !string.IsNullOrEmpty(d)))
                    : a.Description;

                string? clientName = !string.IsNullOrWhiteSpace(a.ClientName) && a.ClientName != "Consumidor Final"
                    ? a.ClientName
                    : (firstTx?.User?.FullName ?? a.ClientName ?? "Consumidor Final");

                return new
                {
                    id = a.Id,
                    createdAt = a.CreatedAt,
                    completedAt = a.CompletedAt,
                    externalPaymentId = a.ExternalPaymentId,
                    cloverPaymentId = a.CloverPaymentId,
                    cloverOrderId = a.CloverOrderId,
                    orderReference = a.OrderReference,
                    sourceModule = a.SourceModule,
                    clientName = clientName,
                    description = txDescription ?? "-",
                    processedBy = a.ProcessedBy ?? "Sistema",
                    deviceId = a.DeviceId,
                    amount = a.Amount,
                    status = a.Status,
                    statusDetail = a.StatusDetail,
                    cardBrand = a.CardBrand,
                    cardLast4 = a.CardLast4,
                    authCode = a.AuthCode,
                    entryType = a.EntryType,
                    paymentGroupId = a.PaymentGroupId,
                    transactionId = firstTx?.Id,
                    arcaStatus = firstTx?.ArcaStatus,
                    invoiceNumber = firstTx?.InvoiceNumber,
                    invoiceType = firstTx?.InvoiceType,
                    cae = firstTx?.Cae,
                    puntoDeVenta = ptoVta
                };
            });

            return Ok(result);
        }

        [HttpGet("audit/{id}/verify")]
        public async Task<IActionResult> VerifyAuditWithClover(int id)
        {
            try
            {
                var result = await _cloverService.VerifyPaymentWithCloverAsync(id);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("device")]
        public async Task<IActionResult> GetCloverDevice()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            var deviceId = user?.CloverDeviceId;
            if (string.IsNullOrWhiteSpace(deviceId))
            {
                deviceId = await _context.Users
                    .Where(u => u.CloverDeviceId != null && u.CloverDeviceId != "")
                    .Select(u => u.CloverDeviceId)
                    .FirstOrDefaultAsync();
            }

            return Ok(new { deviceId = deviceId ?? string.Empty });
        }

        [HttpPost("device")]
        public async Task<IActionResult> SetCloverDevice([FromBody] SetCloverDeviceRequest request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            user.CloverDeviceId = request.DeviceId?.Trim() ?? string.Empty;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Dispositivo Clover asignado exitosamente a su puesto." });
        }
    }

    public class CloverChargeRequest
    {
        public decimal Amount { get; set; }
        public string OrderId { get; set; } = string.Empty;
        public string DeviceId { get; set; } = string.Empty;
        public string? SourceModule { get; set; }
        public string? ClientName { get; set; }
        public string? Description { get; set; }
    }

    public class LinkCloverTransactionRequest
    {
        public Guid? PaymentGroupId { get; set; }
        public string? ClientName { get; set; }
        public string? Description { get; set; }
    }

    public class SetCloverDeviceRequest
    {
        public string DeviceId { get; set; } = string.Empty;
    }
}