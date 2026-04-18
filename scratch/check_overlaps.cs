using Microsoft.EntityFrameworkCore;
using PadelQ.Infrastructure.Persistence;
using PadelQ.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

var builder = new ConfigurationBuilder()
    .AddJsonFile("PadelQ.Api/appsettings.Development.json");
var configuration = builder.Build();

var services = new ServiceCollection();
services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

using var serviceProvider = services.BuildServiceProvider();
using var scope = serviceProvider.CreateScope();
var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

var courtId = 1;
var start = new DateTime(2026, 04, 18, 22, 0, 0); // User is 17 but maybe server is 18?
var end = start.AddMinutes(120);

Console.WriteLine($"Checking Court {courtId} from {start} to {end}");

var overlapping = await context.Bookings
    .Where(b => b.CourtId == courtId && b.Status != BookingStatus.Cancelled)
    .Where(b => (b.StartTime < end && b.EndTime > start))
    .ToListAsync();

if (overlapping.Any())
{
    foreach (var b in overlapping)
    {
        Console.WriteLine($"OVERLAP: ID {b.Id}, User {b.UserId}/{b.GuestName}, Start {b.StartTime}, End {b.EndTime}, Status {b.Status}");
    }
}
else
{
    Console.WriteLine("No overlaps found in typical query.");
}
