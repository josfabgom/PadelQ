using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Domain.Interfaces;

using PadelQ.Infrastructure.Identity;
using PadelQ.Infrastructure.Persistence;
using PadelQ.Infrastructure.Services;
using PadelQ.Infrastructure.BackgroundServices;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// DB Context
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
           .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));


// Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequiredLength = 3;
})
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// JWT
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "esta_es_una_clave_secreta_muy_larga_de_al_menos_32_caracteres"))
    };
});

// DI Services
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<ICourtService, CourtService>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IActivityService, ActivityService>();
builder.Services.AddScoped<IQrService, QrService>();
builder.Services.AddScoped<IBillingService, BillingService>();
builder.Services.AddScoped<IChatbotService, ChatbotService>();
builder.Services.AddHttpClient<IArcaService, ArcaService>();
builder.Services.AddHttpClient<ICloverService, CloverService>();
builder.Services.AddHttpClient<IMercadoPagoService, MercadoPagoService>();
builder.Services.AddHostedService<BillingBackgroundService>();
builder.Services.AddMemoryCache();
builder.Services.AddSignalR();

 builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Use Exception Handler
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        // Add CORS Headers to Error Responses too
        context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        context.Response.Headers.Append("Access-Control-Allow-Headers", "*");
        
        context.Response.StatusCode = 500;
        await context.Response.WriteAsJsonAsync(new { error = "Internal Server Error" });
    });
});

// Enable CORS
app.UseCors("AllowReactApp");

// SEED DATA
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        
        await context.Database.MigrateAsync();
        
        // Parche manual para restaurar columnas que faltan en las migraciones pero existen en el ModelSnapshot
        try {
            await context.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Transactions') AND name = 'BookingId') ALTER TABLE Transactions ADD BookingId UNIQUEIDENTIFIER NULL;");
            await context.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Transactions') AND name = 'SpaceBookingId') ALTER TABLE Transactions ADD SpaceBookingId UNIQUEIDENTIFIER NULL;");
            await context.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Transactions') AND name = 'ActivityId') ALTER TABLE Transactions ADD ActivityId INT NULL;");
            await context.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Transactions') AND name = 'ActivityDate') ALTER TABLE Transactions ADD ActivityDate DATETIME2 NULL;");
            
            await context.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ClubActivities') AND name = 'InstructorId') ALTER TABLE ClubActivities ADD InstructorId NVARCHAR(450) NULL;");
            
            await context.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'IsDoubleUnitCombo') ALTER TABLE Products ADD IsDoubleUnitCombo BIT NOT NULL DEFAULT 0;");
            await context.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BookingConsumptions') AND name = 'IsComboRedeemed') ALTER TABLE BookingConsumptions ADD IsComboRedeemed BIT NOT NULL DEFAULT 0;");
            await context.Database.ExecuteSqlRawAsync("ALTER TABLE Transactions ALTER COLUMN ArcaStatus NVARCHAR(500) NULL;");
            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CloverPaymentAudits')
                BEGIN
                    CREATE TABLE CloverPaymentAudits (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        ExternalPaymentId NVARCHAR(64) NOT NULL,
                        CloverPaymentId NVARCHAR(64) NULL,
                        CloverOrderId NVARCHAR(64) NULL,
                        OrderReference NVARCHAR(128) NULL,
                        SourceModule NVARCHAR(64) NOT NULL,
                        ClientName NVARCHAR(200) NULL,
                        Description NVARCHAR(500) NULL,
                        ProcessedBy NVARCHAR(128) NULL,
                        DeviceId NVARCHAR(64) NOT NULL,
                        Amount DECIMAL(18,2) NOT NULL,
                        Status NVARCHAR(32) NOT NULL,
                        StatusDetail NVARCHAR(500) NULL,
                        CardBrand NVARCHAR(50) NULL,
                        CardLast4 NVARCHAR(16) NULL,
                        AuthCode NVARCHAR(64) NULL,
                        EntryType NVARCHAR(64) NULL,
                        PaymentGroupId UNIQUEIDENTIFIER NULL,
                        CreatedAt DATETIME2 NOT NULL,
                        CompletedAt DATETIME2 NULL
                    );
                END");

            if (!await context.CloverPaymentAudits.AnyAsync())
            {
                var histCloverTxs = await context.Transactions
                    .Include(t => t.User)
                    .Include(t => t.PaymentMethod)
                    .Where(t => t.PaymentMethod != null && t.PaymentMethod.Name.ToUpper().Contains("CLOVER"))
                    .OrderBy(t => t.Date)
                    .ToListAsync();

                var groupedHist = histCloverTxs
                    .GroupBy(t => t.PaymentGroupId ?? Guid.NewGuid())
                    .ToList();

                foreach (var g in groupedHist)
                {
                    var first = g.First();
                    string desc = string.Join(" + ", g.Select(x => x.Description).Where(d => !string.IsNullOrEmpty(d)));
                    if (desc.Length > 490) desc = desc.Substring(0, 490);
                    string srcModule = desc.Contains("Venta Directa", StringComparison.OrdinalIgnoreCase)
                        ? "Venta Directa"
                        : (first.BookingId.HasValue || first.SpaceBookingId.HasValue || desc.Contains("Cancha", StringComparison.OrdinalIgnoreCase)
                            ? "Reserva / Turno"
                            : "Cobro POS");

                    context.CloverPaymentAudits.Add(new PadelQ.Domain.Entities.CloverPaymentAudit
                    {
                        ExternalPaymentId = $"HIST-{first.Id}",
                        OrderReference = (first.BookingId ?? first.SpaceBookingId)?.ToString(),
                        SourceModule = srcModule,
                        ClientName = first.User?.FullName ?? "Consumidor Final",
                        Description = desc,
                        ProcessedBy = first.ProcessedBy ?? "Sistema",
                        DeviceId = "C046LT44820603",
                        Amount = g.Sum(x => x.Amount),
                        Status = "APPROVED",
                        StatusDetail = "Pago registrado en terminal Clover",
                        PaymentGroupId = first.PaymentGroupId,
                        CreatedAt = first.Date,
                        CompletedAt = first.Date
                    });
                }
                await context.SaveChangesAsync();
            }
        } catch (Exception patchEx) {
            Console.WriteLine("Aviso en inicialización de tabla CloverPaymentAudits: " + patchEx.Message);
        }

        await DbInitializer.SeedAsync(services);
        PadelQ.Api.UserDiagnostic.PrintUsers(services);
        Diagnostics.DateCheck.Run(services);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocurrió un error al realizar el seeding de la DB.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();

// app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<PadelQ.Api.Hubs.KitchenHub>("/kitchenHub");

app.Run();
