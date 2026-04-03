using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PadelQ.Application.Common.Interfaces;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.BackgroundServices
{
    public class BillingBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<BillingBackgroundService> _logger;

        public BillingBackgroundService(IServiceProvider serviceProvider, ILogger<BillingBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Billing Background Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("Billing Background Service is checking for memberships to charge...");

                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var billingService = scope.ServiceProvider.GetRequiredService<IBillingService>();
                        var chargesCreated = await billingService.GenerateMonthlyChargesAsync();

                        if (chargesCreated > 0)
                        {
                            _logger.LogInformation($"Billing Background Service: Created {chargesCreated} new charges.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred executing Billing Background Service.");
                }

                // Run once every 24 hours
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }

            _logger.LogInformation("Billing Background Service is stopping.");
        }
    }
}
