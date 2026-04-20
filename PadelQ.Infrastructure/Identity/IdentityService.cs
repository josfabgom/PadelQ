using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Application.Common.Models;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Identity
{
    public class IdentityService : IIdentityService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IConfiguration _configuration;
        private readonly ApplicationDbContext _context;

        public IdentityService(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            IConfiguration configuration,
            ApplicationDbContext context)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _context = context;
        }

        public async Task<(bool Succeeded, string UserId)> CreateUserAsync(string userName, string email, string password, string fullName, string? dni, string? phoneNumber, string? role = "User")
        {
            if (!string.IsNullOrEmpty(dni))
            {
                var existingUser = await _userManager.Users.AnyAsync(u => u.Dni == dni);
                if (existingUser) return (false, "DNI_ALREADY_EXISTS");
            }

            var user = new ApplicationUser
            {
                UserName = userName,
                Email = email,
                FullName = fullName,
                Dni = dni,
                PhoneNumber = phoneNumber,
                IsActive = true
            };

            var result = await _userManager.CreateAsync(user, password);
            if (!result.Succeeded) return (false, result.Errors.FirstOrDefault()?.Code ?? "UNKNOWN_ERROR");

            // Assign role
            if (!string.IsNullOrEmpty(role))
            {
                if (!await _roleManager.RoleExistsAsync(role))
                {
                    await _roleManager.CreateAsync(new IdentityRole(role));
                }
                await _userManager.AddToRoleAsync(user, role);
            }

            return (true, user.Id);
        }

        public async Task<(string Token, string FullName, string Email, List<string> Roles)?> LoginAsync(string emailOrUser, string password)
        {
            var user = await _userManager.FindByEmailAsync(emailOrUser);
            if (user == null)
            {
                user = await _userManager.FindByNameAsync(emailOrUser);
            }

            if (user == null)
            {
                System.IO.File.AppendAllText("login_diag.txt", $"Login Failed: User {emailOrUser} not found.\n");
                return null;
            }

            var passwordValid = await _userManager.CheckPasswordAsync(user, password);
            if (!passwordValid)
            {
                System.IO.File.AppendAllText("login_diag.txt", $"Login Failed: User {emailOrUser} found, but password invalid.\n");
                return null;
            }

            var roles = (await _userManager.GetRolesAsync(user)).ToList();
            var token = await GenerateJwtTokenAsync(user);
            return (token, user.FullName ?? "", user.Email ?? "", roles);
        }

        public async Task<bool> IsEmailUniqueAsync(string email)
        {
            var user = await _userManager.FindByEmailAsync(email);
            return user == null;
        }

        public async Task<List<PadelQ.Application.Common.Models.UserDto>> GetUsersAsync()
        {
            var users = _userManager.Users.ToList();
            var dtos = new List<PadelQ.Application.Common.Models.UserDto>();

            foreach (var u in users)
            {
                var charges = _context.Transactions
                    .Where(t => t.UserId == u.Id && t.Type == TransactionType.Charge)
                    .Sum(t => (decimal?)t.Amount) ?? 0m;

                var payments = _context.Transactions
                    .Where(t => t.UserId == u.Id && t.Type == TransactionType.Payment)
                    .Sum(t => (decimal?)t.Amount) ?? 0m;

                var activeMembership = _context.UserMemberships
                    .Include(um => um.Membership)
                    .Where(um => um.UserId == u.Id && um.IsActive)
                    .OrderByDescending(um => um.StartDate)
                    .FirstOrDefault();

                var lastMembershipPayment = _context.Transactions
                    .Where(t => t.UserId == u.Id && t.Type == TransactionType.MembershipPayment)
                    .OrderByDescending(t => t.Date)
                    .FirstOrDefault();

                var isExpired = activeMembership == null || lastMembershipPayment == null || lastMembershipPayment.Date < DateTime.UtcNow.AddDays(-30);
                var expiryDate = lastMembershipPayment?.Date.AddDays(30);

                dtos.Add(new PadelQ.Application.Common.Models.UserDto
                {
                    Id = u.Id,
                    FullName = u.FullName ?? "",
                    Email = u.Email ?? "",
                    PhoneNumber = u.PhoneNumber,
                    Dni = u.Dni,
                    Address = u.Address,
                    City = u.City,
                    Province = u.Province,
                    PhotoUrl = u.PhotoUrl,
                    Balance = charges - payments,
                    MembershipName = activeMembership?.Membership?.Name,
                    DiscountPercentage = 0, // No automatic discounts per v2.8 internal requirements
                    MembershipHexColor = activeMembership?.Membership?.HexColor,
                    IsActive = u.IsActive,
                    CanAccessActivities = u.CanAccessActivities,
                    CanAccessBookings = u.CanAccessBookings,
                    ExpiryDate = expiryDate,
                    CoverageStartDate = expiryDate?.AddDays(-30),
                    IsExpired = isExpired,
                    Role = (await _userManager.GetRolesAsync(u)).FirstOrDefault()
                });
            }

            return dtos;
        }

        public async Task<PadelQ.Application.Common.Models.UserDto?> GetUserByIdAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return null;

            var charges = _context.Transactions
                .Where(t => t.UserId == user.Id && t.Type == TransactionType.Charge)
                .Sum(t => (decimal?)t.Amount) ?? 0m;

            var payments = _context.Transactions
                .Where(t => t.UserId == user.Id && t.Type == TransactionType.Payment)
                .Sum(t => (decimal?)t.Amount) ?? 0m;

            var activeMembership = _context.UserMemberships
                .Include(um => um.Membership)
                .Where(um => um.UserId == user.Id && um.IsActive)
                .OrderByDescending(um => um.StartDate)
                .FirstOrDefault();

            var lastMembershipPayment = _context.Transactions
                .Where(t => t.UserId == user.Id && t.Type == TransactionType.MembershipPayment)
                .OrderByDescending(t => t.Date)
                .FirstOrDefault();

            var isExpired = activeMembership == null || lastMembershipPayment == null || lastMembershipPayment.Date < DateTime.UtcNow.AddDays(-30);
            var expiryDate = lastMembershipPayment?.Date.AddDays(30);

            return new PadelQ.Application.Common.Models.UserDto
            {
                Id = user.Id,
                FullName = user.FullName ?? "",
                Email = user.Email ?? "",
                PhoneNumber = user.PhoneNumber,
                Dni = user.Dni,
                Address = user.Address,
                City = user.City,
                Province = user.Province,
                PhotoUrl = user.PhotoUrl,
                Balance = charges - payments,
                MembershipName = activeMembership?.Membership?.Name,
                DiscountPercentage = 0, // No automatic discounts per v2.8 internal requirements
                MembershipHexColor = activeMembership?.Membership?.HexColor,
                IsActive = user.IsActive,
                CanAccessActivities = user.CanAccessActivities,
                CanAccessBookings = user.CanAccessBookings,
                ExpiryDate = expiryDate,
                CoverageStartDate = expiryDate?.AddDays(-30),
                IsExpired = isExpired,
                Role = (await _userManager.GetRolesAsync(user)).FirstOrDefault()
            };
        }

        public async Task<(bool Succeeded, string Message)> UpdateUserAsync(string userId, string fullName, string email, string? phoneNumber, bool isActive, string? dni, string? address, string? city, string? province, string? photoUrl, string? role, bool canAccessActivities, bool canAccessBookings)
        {
            if (!string.IsNullOrEmpty(dni))
            {
                var existingUser = await _userManager.Users.AnyAsync(u => u.Dni == dni && u.Id != userId);
                if (existingUser) return (false, "DNI_ALREADY_EXISTS");
            }
 
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return (false, "USER_NOT_FOUND");
 
            user.FullName = fullName;
            user.Email = email;
            user.UserName = email;
            user.PhoneNumber = phoneNumber;
            user.IsActive = isActive;
            user.Dni = dni;
            user.Address = address;
            user.City = city;
            user.Province = province;
            user.PhotoUrl = photoUrl;
            user.CanAccessActivities = canAccessActivities;
            user.CanAccessBookings = canAccessBookings;
 
            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded) return (false, result.Errors.FirstOrDefault()?.Code ?? "UNKNOWN_ERROR");

            // Update Role
            if (!string.IsNullOrEmpty(role))
            {
                var currentRoles = await _userManager.GetRolesAsync(user);
                if (!currentRoles.Contains(role))
                {
                    await _userManager.RemoveFromRolesAsync(user, currentRoles);
                    await _userManager.AddToRoleAsync(user, role);
                }
            }

            return (true, "SUCCESS");
        }

        public async Task<bool> DeleteUserAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return false;

            // Constraint: No se puede borrar si ya tiene pagos registrados
            var hasPayments = await _context.Transactions.AnyAsync(t => t.UserId == userId && t.Type == TransactionType.Payment);
            if (hasPayments)
            {
                throw new InvalidOperationException("No se puede eliminar un cliente con historial de pagos. Considere desactivarlo.");
            }

            var result = await _userManager.DeleteAsync(user);
            return result.Succeeded;
        }

        public async Task<(bool Succeeded, string Message)> ChangePasswordAsync(string userId, string newPassword)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return (false, "USER_NOT_FOUND");

            var removeResult = await _userManager.RemovePasswordAsync(user);
            if (!removeResult.Succeeded) return (false, removeResult.Errors.FirstOrDefault()?.Description ?? "ERROR_REMOVING_PASSWORD");

            var addResult = await _userManager.AddPasswordAsync(user, newPassword);
            if (!addResult.Succeeded) return (false, addResult.Errors.FirstOrDefault()?.Description ?? "ERROR_ADDING_PASSWORD");

            return (true, "PASSWORD_CHANGED_SUCCESSFULLY");
        }

        public async Task<PadelQ.Application.Common.Models.UserDto?> GetUserByDniAsync(string dni)
        {
            var user = await _userManager.Users.FirstOrDefaultAsync(u => u.Dni == dni);
            if (user == null) return null;
            return await GetUserByIdAsync(user.Id);
        }

        private async Task<string> GenerateJwtTokenAsync(ApplicationUser user)
        {
            var userRoles = await _userManager.GetRolesAsync(user);

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                new Claim(JwtRegisteredClaimNames.Email, user.Email!),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim("FullName", user.FullName ?? "")
            };

            foreach (var role in userRoles)
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? "esta_es_una_clave_secreta_muy_larga_de_al_menos_32_caracteres"));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires = DateTime.UtcNow.AddDays(7);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: expires,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
