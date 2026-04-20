using Microsoft.Extensions.DependencyInjection;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Linq;

namespace Diagnostics
{
    public class DateCheck
    {
        public static void Run(IServiceProvider services)
        {
            var context = services.GetRequiredService<ApplicationDbContext>();
            var bookings = context.Bookings.Take(10).ToList();
            
            Console.WriteLine("--- DIAGNÓSTICO DE FECHAS EN DB ---");
            foreach(var b in bookings)
            {
                Console.WriteLine($"ID: {b.Id} | User: {b.GuestName ?? b.UserId} | Start: {b.StartTime:s} | Kind: {b.StartTime.Kind}");
            }
            Console.WriteLine("-----------------------------------");
        }
    }
}
