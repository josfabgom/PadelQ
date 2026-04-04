using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PadelQ.Domain.Entities;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Persistence
{
    public static class DbInitializer
    {
        public static async Task SeedAsync(IServiceProvider serviceProvider)
        {
            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var context = serviceProvider.GetRequiredService<ApplicationDbContext>();
 
            await context.Database.MigrateAsync();

            // 1. Roles
            string[] roles = { "Admin", "User", "Merchant", "Staff" };
            foreach (var role in roles)
            {
                if (!await roleManager.RoleExistsAsync(role))
                {
                    await roleManager.CreateAsync(new IdentityRole(role));
                }
            }

            // 2. Admin User
            var adminUser = await userManager.FindByEmailAsync("admin@padelq.com");
            if (adminUser == null)
            {
                adminUser = await userManager.FindByNameAsync("Admin");
            }

            if (adminUser == null)
            {
                adminUser = new ApplicationUser
                {
                    UserName = "Admin",
                    Email = "admin@padelq.com",
                    FullName = "Administrador Sistema",
                    EmailConfirmed = true
                };
                await userManager.CreateAsync(adminUser, "123");
            }

            if (!await userManager.IsInRoleAsync(adminUser, "Admin"))
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }

            // 3. Initial Courts
            if (!context.Courts.Any())
            {
                context.Courts.AddRange(
                    new Court { Name = "Cancha 1 - Cristal Panorámico", IsIndoor = true, SurfaceType = "Glass", PricePerHour = 30.0m },
                    new Court { Name = "Cancha 2 - Estándar", IsIndoor = false, SurfaceType = "Concrete", PricePerHour = 20.0m }
                );
                await context.SaveChangesAsync();
            }

            // 4. Initial Settings
            if (!context.SystemSettings.Any())
            {
                context.SystemSettings.AddRange(
                    new SystemSetting { Key = "PricePerHour", Value = "25.0" },
                    new SystemSetting { Key = "OpenHour", Value = "8" },
                    new SystemSetting { Key = "CloseHour", Value = "23" }
                );
                await context.SaveChangesAsync();
            }

            // 5. Initial Memberships
            if (!context.Memberships.Any())
            {
                context.Memberships.AddRange(
                    new Membership { Name = "Socio Oro", MonthlyPrice = 5000, DiscountPercentage = 20, Description = "Acceso total y máximo descuento" },
                    new Membership { Name = "Socio Plata", MonthlyPrice = 3000, DiscountPercentage = 10, Description = "Acceso estándar" }
                );
                await context.SaveChangesAsync();
            }

            // 6. Assign Membership to Admin
            var goldMembership = context.Memberships.FirstOrDefault(m => m.Name == "Socio Oro");
            if (goldMembership != null && !context.UserMemberships.Any(um => um.UserId == adminUser.Id))
            {
                context.UserMemberships.Add(new UserMembership
                {
                    UserId = adminUser.Id,
                    MembershipId = goldMembership.Id,
                    StartDate = DateTime.UtcNow,
                    IsActive = true
                });
                await context.SaveChangesAsync();
            }
        }
    }
}
