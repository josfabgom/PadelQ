using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Api.Controllers
{
    [ApiController]
    [Route("api/paymentmethods")]
    [Authorize(Roles = "Admin")]
    public class PaymentMethodsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PaymentMethodsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous] // Public for mobile app to show options
        public async Task<ActionResult<IEnumerable<PaymentMethod>>> GetPaymentMethods()
        {
            return await _context.PaymentMethods.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PaymentMethod>> GetPaymentMethod(int id)
        {
            var method = await _context.PaymentMethods.FindAsync(id);
            if (method == null) return NotFound();
            return method;
        }

        [HttpPost]
        public async Task<ActionResult<PaymentMethod>> CreatePaymentMethod([FromBody] PaymentMethod method)
        {
            _context.PaymentMethods.Add(method);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetPaymentMethod), new { id = method.Id }, method);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePaymentMethod(int id, [FromBody] PaymentMethod method)
        {
            if (id != method.Id) return BadRequest();
            _context.Entry(method).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePaymentMethod(int id)
        {
            var method = await _context.PaymentMethods.FindAsync(id);
            if (method == null) return NotFound();

            // Prevent deletion if used in transactions
            var used = await _context.Transactions.AnyAsync(t => t.PaymentMethodId == id);
            if (used)
            {
                method.IsActive = false; // Soft delete
                _context.Entry(method).State = EntityState.Modified;
            }
            else
            {
                _context.PaymentMethods.Remove(method);
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
