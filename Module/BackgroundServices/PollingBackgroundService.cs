using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Services;

namespace Module.BackgroundServices;

public class PollingBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PollingBackgroundService> _logger;

    public PollingBackgroundService(IServiceProvider serviceProvider, ILogger<PollingBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Polling Background Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DoWorkAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in Polling Background Service.");
            }

            // Wait for 1 minute before checking again
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task DoWorkAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var apiSyncService = scope.ServiceProvider.GetRequiredService<IApiSyncService>();

        var now = DateTime.UtcNow;

        // Fetch configs that are enabled and due for polling
        var configsToPoll = await context.ExternalApiConfigs
            .Where(c => c.IsPollingEnabled)
            .ToListAsync(stoppingToken);

        foreach (var config in configsToPoll)
        {
            if (stoppingToken.IsCancellationRequested) break;

            bool isDue = config.LastPolledAt == null || 
                         config.LastPolledAt.Value.AddMinutes(config.PollingIntervalMinutes) <= now;

            if (isDue)
            {
                _logger.LogInformation("Polling API for config: {ConfigName} (ID: {ConfigId})", config.Name, config.Id);
                
                try 
                {
                    var result = await apiSyncService.ExecuteSyncAsync(config.Id, config.TenantId);
                    _logger.LogInformation("Poll result for {ConfigName}: {Message}", config.Name, result.Message);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error polling API for config: {ConfigName}", config.Name);
                }
            }
        }
    }
}
