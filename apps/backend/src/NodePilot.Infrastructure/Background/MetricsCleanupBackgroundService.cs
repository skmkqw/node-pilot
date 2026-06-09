using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;
using NodePilot.Application.Monitoring.Settings;

namespace NodePilot.Infrastructure.Background;

public sealed class MetricsCleanupBackgroundService(
    IServiceScopeFactory scopeFactory,
    IMonitoringSettingsProvider monitoringSettingsProvider,
    ILogger<MetricsCleanupBackgroundService> logger) : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

    private readonly IMonitoringSettingsProvider _monitoringSettingsProvider = monitoringSettingsProvider;

    private readonly ILogger<MetricsCleanupBackgroundService> _logger = logger;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            RetentionSettings settings =
                _monitoringSettingsProvider.Current.Retention;

            try
            {

                if (settings.CleanupEnabled)
                {
                    await CleanupMetricsAsync(
                        Math.Max(1, settings.MaxMetricAgeHours),
                        ct);
                }
                else
                {
                    _logger.LogInformation(
                        "Metrics cleanup skipped because retention cleanup is disabled.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Metrics cleanup iteration failed.");
            }

            var delay =
                TimeSpan.FromMinutes(
                    settings.CleanupIntervalMinutes);

            await Task.Delay(delay, ct);
        }
    }

    private async Task CleanupMetricsAsync(int maxAgeHours, CancellationToken ct)
    {
        await using AsyncServiceScope scope = _scopeFactory.CreateAsyncScope();

        IMetricsRetentionService retentionService =
            scope.ServiceProvider
                .GetRequiredService<IMetricsRetentionService>();

        var retention = TimeSpan.FromHours(maxAgeHours);

        RetentionResult result = await retentionService.ApplyRetentionAsync(retention, ct);

        TimeSpan duration =
            result.CompletedAtUtc - result.StartedAtUtc;

        _logger.LogInformation(
            "Metrics cleanup job completed in {Duration} at {CompletedAt}. Cutoff: {Cutoff}. Total records deleted: {TotalDeleted}",
                duration,
                result.CompletedAtUtc,
                result.CutoffUtc,
                result.DeletedMetrics);
    }
}
