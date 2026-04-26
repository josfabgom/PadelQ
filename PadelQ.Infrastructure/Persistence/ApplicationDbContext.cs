using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PadelQ.Domain.Entities;

namespace PadelQ.Infrastructure.Persistence
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<Booking> Bookings { get; set; } = null!;
        public DbSet<Court> Courts { get; set; } = null!;
        public DbSet<SystemSetting> SystemSettings { get; set; } = null!;
        public DbSet<ClubActivity> ClubActivities { get; set; } = null!;
        public DbSet<ActivitySchedule> ActivitySchedules { get; set; } = null!;
        public DbSet<ActivitySignup> ActivitySignups { get; set; } = null!;
        public DbSet<Membership> Memberships { get; set; } = null!;
        public DbSet<UserMembership> UserMemberships { get; set; } = null!;
        public DbSet<Transaction> Transactions { get; set; } = null!;
        public DbSet<PaymentMethod> PaymentMethods { get; set; } = null!;
        public DbSet<Space> Spaces { get; set; } = null!;
        public DbSet<SpaceBooking> SpaceBookings { get; set; } = null!;
        public DbSet<Product> Products { get; set; } = null!;
        public DbSet<BookingConsumption> BookingConsumptions { get; set; } = null!;
        public DbSet<ProductStockMovement> ProductStockMovements { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ApplicationUser>(entity => {
                entity.HasIndex(u => u.Dni).IsUnique().HasFilter("[Dni] IS NOT NULL");
                entity.Property(u => u.PlayerLevel).HasPrecision(18, 2);
            });

            builder.Entity<ClubActivity>().Property(b => b.Price).HasPrecision(18, 2);
            builder.Entity<Court>().Property(b => b.PricePerHour).HasPrecision(18, 2);
            builder.Entity<Booking>().Property(b => b.Price).HasPrecision(18, 2);
            builder.Entity<Booking>().Property(b => b.DepositPaid).HasPrecision(18, 2);
            builder.Entity<Membership>().Property(b => b.MonthlyPrice).HasPrecision(18, 2);
            builder.Entity<Transaction>().Property(b => b.Amount).HasPrecision(18, 2);
            builder.Entity<Space>().Property(b => b.PricePerSlot).HasPrecision(18, 2);
            builder.Entity<SpaceBooking>().Property(b => b.Price).HasPrecision(18, 2);
            builder.Entity<SpaceBooking>().Property(b => b.DepositPaid).HasPrecision(18, 2);
            builder.Entity<Product>().Property(p => p.FinalPrice).HasPrecision(18, 2);
            builder.Entity<Product>().Property(p => p.CostPrice).HasPrecision(18, 2);
            builder.Entity<BookingConsumption>().Property(bc => bc.UnitPrice).HasPrecision(18, 2);

            // No forzamos UTC de forma global para permitir que las reservas se guarden y lean como 'Wall Clock Time' (Hora Local)
        }
    }
}
