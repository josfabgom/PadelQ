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
        private readonly IConfiguration _configuration;
        private readonly ApplicationDbContext _context;

        public IdentityService(
            UserManager<ApplicationUser> userManager,
            IConfiguration configuration,
            ApplicationDbContext context)
        {
            _userManager = userManager;
            _configuration = configuration;
            _context = context;
        }

        public async Task<(bool Succeeded, string UserId)> CreateUserAsync(string fullName, string email, string password)
        {
            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FullName = fullName
            };

            var result = await _userManager.CreateAsync(user, password);
            return (result.Succeeded, user.Id);
        }

        public async Task<string?> LoginAsync(string emailOrUser, string password)
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

            return await GenerateJwtTokenAsync(user);
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
                    .Select(um => um.Membership!.Name)
                    .FirstOrDefault();

                dtos.Add(new PadelQ.Application.Common.Models.UserDto
                {
                    Id = u.Id,
                    FullName = u.FullName ?? "",
                    Email = u.Email ?? "",
                    PhoneNumber = u.PhoneNumber,
                    Balance = charges - payments,
                    MembershipName = activeMembership
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
                .Select(um => um.Membership!.Name)
                .FirstOrDefault();

            return new PadelQ.Application.Common.Models.UserDto
            {
                Id = user.Id,
                FullName = user.FullName ?? "",
                Email = user.Email ?? "",
                PhoneNumber = user.PhoneNumber,
                Balance = charges - payments,
                MembershipName = activeMembership
            };
        }

        public async Task<bool> UpdateUserAsync(string userId, string fullName, string email)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return false;

            user.FullName = fullName;
            user.Email = email;
            user.UserName = email;

            var result = await _userManager.UpdateAsync(user);
            return result.Succeeded;
        }

        public async Task<bool> DeleteUserAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return false;

            var result = await _userManager.DeleteAsync(user);
            return result.Succeeded;
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
