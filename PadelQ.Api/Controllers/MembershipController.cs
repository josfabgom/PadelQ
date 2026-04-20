using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Domain.Interfaces;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using PadelQ.Application.Common.Interfaces;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/membership")]
    [Authorize]
    public class MembershipController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IQrService _qrService;

        public MembershipController(ApplicationDbContext context, IQrService qrService)
        {
            _context = context;
            _qrService = qrService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Membership>>> GetMemberships()
        {
            return await _context.Memberships.ToListAsync();
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Membership>> CreateMembership([FromBody] Membership membership)
        {
            _context.Memberships.Add(membership);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetMemberships), new { id = membership.Id }, membership);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateMembership(int id, Membership membership)
        {
            if (id != membership.Id) return BadRequest();

            _context.Entry(membership).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Memberships.Any(e => e.Id == id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteMembership(int id)
        {
            var membership = await _context.Memberships.FindAsync(id);
            if (membership == null) return NotFound();

            // Check if any users are using this membership
            var inUse = await _context.UserMemberships.AnyAsync(um => um.MembershipId == id && um.IsActive);
            if (inUse) return BadRequest("Cannot delete a membership that is currently in use by active users.");

            _context.Memberships.Remove(membership);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("subscribe")]
        [Authorize(Roles = "Admin,Staff,Merchant")]
        public async Task<IActionResult> SubscribeUser(string userId, int membershipId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found");

            // Prevent membership for Administrative Roles
            var isAdministrative = await _context.UserRoles
                .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                .AnyAsync(x => x.UserId == userId && (x.Name == "Staff" || x.Name == "Merchant"));

            if (isAdministrative)
            {
                return BadRequest("No se puede asignar una membresía a un perfil administrativo.");
            }

            var membership = await _context.Memberships.FindAsync(membershipId);
            if (membership == null) return NotFound("Membership not found");

            // Deactivate previous active memberships
            var activeMemberships = await _context.UserMemberships
                .Where(um => um.UserId == userId && um.IsActive)
                .ToListAsync();

            foreach (var am in activeMemberships)
            {
                am.IsActive = false;
                am.EndDate = DateTime.UtcNow;
            }

            var userMembership = new UserMembership
            {
                UserId = userId,
                MembershipId = membershipId,
                StartDate = DateTime.UtcNow,
                IsActive = true
            };

            _context.UserMemberships.Add(userMembership);
            
            // Log membership payment (Descriptive only, does not affect financial balance)
            var transaction = new Transaction
            {
                UserId = userId,
                Amount = membership.MonthlyPrice,
                Date = DateTime.UtcNow,
                Type = TransactionType.MembershipPayment,
                Description = $"Abono Membresía Inicial - {membership.Name}"
            };
            _context.Transactions.Add(transaction);

            await _context.SaveChangesAsync();

            return Ok(userMembership);
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserMembership(string userId)
        {
            var now = DateTime.UtcNow;
            var userMembership = await _context.UserMemberships
                .Include(um => um.Membership)
                .Where(um => um.UserId == userId 
                    && um.IsActive 
                    && um.StartDate <= now
                    && (um.EndDate == null || um.EndDate >= now))
                .OrderByDescending(um => um.StartDate)
                .FirstOrDefaultAsync();

            if (userMembership == null) 
            {
                // Si no hay membresía activa y paga, devolvemos un estado informativo
                return NotFound("No active or paid membership found");
            }

            return Ok(new
            {
                id = userMembership.Id,
                userId = userMembership.UserId,
                membershipId = userMembership.MembershipId,
                startDate = userMembership.StartDate,
                endDate = userMembership.EndDate,
                isActive = userMembership.IsActive,
                isPaid = userMembership.IsPaid,
                membership = userMembership.Membership,
                actualDiscount = userMembership.Membership?.DiscountPercentage ?? 0
            });
        }

        [HttpGet("generate-qr")]
        public async Task<ActionResult<string>> GenerateQrToken()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            // Check if user has an active membership
            var hasActiveMembership = await _context.UserMemberships
                .AnyAsync(um => um.UserId == userId && um.IsActive);

            if (!hasActiveMembership) return BadRequest("Se requiere una membresía activa para generar el código QR.");

            var (token, shortCode) = _qrService.GenerateToken(userId);
            return Ok(new { token, shortCode });
        }

        [HttpPost("validate-qr")]
        [Authorize(Roles = "Admin,Merchant")]
        public async Task<IActionResult> ValidateQrToken([FromBody] string token)
        {
            if (!_qrService.ValidateToken(token, out string userId))
            {
                return BadRequest("Código QR inválido o expirado.");
            }

            var user = await _context.Users.FindAsync(userId);
            var now = DateTime.UtcNow;
            var membership = await _context.UserMemberships
                .Include(um => um.Membership)
                .Where(um => um.UserId == userId 
                    && um.IsActive 
                    && um.IsPaid
                    && um.StartDate <= now
                    && (um.EndDate == null || um.EndDate >= now))
                .FirstOrDefaultAsync();

            if (membership == null)
            {
                return BadRequest("El usuario no tiene una membresía activa y pagada.");
            }

            return Ok(new
            {
                UserName = user?.FullName ?? "Usuario Desconocido",
                MembershipName = membership.Membership?.Name,
                Discount = membership.Membership?.DiscountPercentage ?? 0,
                Status = "Active"
            });
        }

        [HttpPost("run-billing")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> RunBilling([FromServices] IBillingService billingService)
        {
            var count = await billingService.GenerateMonthlyChargesAsync();
            return Ok(new { Message = "Billing run completed", ChargesGenerated = count });
        }

    }
}
