using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;
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

        // Process approval escalations
        try
        {
            await ProcessApprovalEscalationsAsync(context, scope.ServiceProvider, stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred in Polling Background Service while processing approval escalations.");
        }

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

    private async Task ProcessApprovalEscalationsAsync(AppDbContext context, IServiceProvider serviceProvider, CancellationToken stoppingToken)
    {
        var now = DateTime.UtcNow;
        var expiredStages = await context.ApprovalStages
            .Include(s => s.ApprovalRequest)
            .Where(s => s.Status == "Pending" && s.EscalationDeadline != null && s.EscalationDeadline <= now && !s.Escalated)
            .ToListAsync(stoppingToken);

        if (!expiredStages.Any()) return;

        _logger.LogInformation("Found {Count} expired approval stages to process escalations.", expiredStages.Count);

        var approvalService = serviceProvider.GetRequiredService<IApprovalService>();
        var notificationService = serviceProvider.GetRequiredService<INotificationService>();

        foreach (var stage in expiredStages)
        {
            if (stoppingToken.IsCancellationRequested) break;

            _logger.LogInformation("Processing escalation for stage ID: {StageId}, Action: {Action}", stage.Id, stage.EscalationAction);

            try
            {
                if (string.Equals(stage.EscalationAction, "AutoReject", StringComparison.OrdinalIgnoreCase))
                {
                    await approvalService.RejectRecordAsync(
                        stage.ApprovalRequest.ModuleId, 
                        stage.ApprovalRequest.ModuleRecordId, 
                        0, // System user ID
                        "Zaman aşımı nedeniyle sistem tarafından otomatik reddedildi."
                    );
                }
                else if (string.Equals(stage.EscalationAction, "AutoApprove", StringComparison.OrdinalIgnoreCase))
                {
                    await approvalService.ApproveRecordAsync(
                        stage.ApprovalRequest.ModuleId, 
                        stage.ApprovalRequest.ModuleRecordId, 
                        0 // System user ID
                    );
                }
                else if (string.Equals(stage.EscalationAction, "Escalate", StringComparison.OrdinalIgnoreCase) && stage.EscalateToRoleId.HasValue)
                {
                    stage.Escalated = true;
                    stage.AssignedToRoleId = stage.EscalateToRoleId;
                    stage.Name = $"{stage.Name} (Eskale Edildi)";
                    
                    await context.SaveChangesAsync(stoppingToken);

                    // Send notification to the escalated role
                    var module = await context.Modules.FindAsync(new object[] { stage.ApprovalRequest.ModuleId }, stoppingToken);
                    await notificationService.SendToRolesAsync(
                        new List<int> { stage.EscalateToRoleId.Value },
                        "GÖREV ESKALASYONU",
                        $"{module?.Name} modülündeki bir onay kaydı zaman aşımı nedeniyle size eskale edilmiştir: {stage.Message}",
                        NotificationType.Warning,
                        $"/modules/{stage.ApprovalRequest.ModuleId}/records/{stage.ApprovalRequest.ModuleRecordId}"
                    );
                }
                else
                {
                    // No action or invalid action, mark as escalated to avoid infinite loop
                    stage.Escalated = true;
                    await context.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing escalation for stage ID {StageId}", stage.Id);
            }
        }
    }
}
