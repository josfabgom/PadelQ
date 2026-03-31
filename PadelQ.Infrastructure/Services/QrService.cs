using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PadelQ.Domain.Interfaces;

namespace PadelQ.Infrastructure.Services
{
    public class QrService : IQrService
    {
        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _cache;
        private readonly string _secretKey;
        private readonly string _issuer;
        private readonly string _audience;

        public QrService(IConfiguration configuration, IMemoryCache cache)
        {
            _configuration = configuration;
            _cache = cache;
            _secretKey = _configuration["Jwt:Key"] ?? "esta_es_una_clave_secreta_muy_larga_de_al_menos_32_caracteres";
            _issuer = _configuration["Jwt:Issuer"] ?? "PadelQ.Api";
            _audience = _configuration["Jwt:Audience"] ?? "PadelQ.MobileApp";
        }

        public (string Token, string ShortCode) GenerateToken(string userId)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_secretKey);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim("userId", userId),
                    new Claim("purpose", "membership_validation")
                }),
                Expires = DateTime.UtcNow.AddMinutes(5),
                Issuer = _issuer,
                Audience = _audience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var jwtToken = tokenHandler.WriteToken(token);

            // Generate a 4-digit short code
            var shortCode = new Random().Next(0, 10000).ToString("D4");
            
            // Store in cache for 5 minutes
            _cache.Set(shortCode, userId, TimeSpan.FromMinutes(5));

            return (jwtToken, shortCode);
        }

        public bool ValidateToken(string token, out string userId)
        {
            userId = string.Empty;

            // Try validating as a short code first
            if (token.Length == 4 && _cache.TryGetValue(token, out string? cachedUserId))
            {
                userId = cachedUserId!;
                return true;
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_secretKey);

            try
            {
                tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = true,
                    ValidIssuer = _issuer,
                    ValidateAudience = true,
                    ValidAudience = _audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken validatedToken);

                var jwtToken = (JwtSecurityToken)validatedToken;
                userId = jwtToken.Claims.First(x => x.Type == "userId").Value;
                var purpose = jwtToken.Claims.First(x => x.Type == "purpose").Value;

                return purpose == "membership_validation";
            }
            catch
            {
                return false;
            }
        }
    }
}
