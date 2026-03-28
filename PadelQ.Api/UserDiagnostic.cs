using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using PadelQ.Domain.Entities;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Api
{
    public static class UserDiagnostic
    {
        public static void PrintUsers(IServiceProvider services)
        {
            var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
            var users = userManager.Users.ToList();
            var log = "--- USER DIAGNOSTIC ---\n";
            foreach (var user in users)
            {
                log += $"User: {user.UserName}, Email: {user.Email}, Name: {user.FullName}\n";
            }
            log += "------------------------\n";
            System.IO.File.WriteAllText("user_diag.txt", log);
        }
    }
}
