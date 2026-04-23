using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Application.Interfaces.SystemStatus;
using NodePilot.Application.SystemStatus;

namespace NodePilot.Infrastructure.Background;

public sealed class MetricsSamplingBackgroundService : BackgroundService
{
    private static readonly TimeSpan SamplingInterval = TimeSpan.FromSeconds(5);

    private readonly IServiceScopeFactory _scopeFactory;

    private readonly ISystemMetricsCollector _collector;
    
    private readonly ILogger<MetricsSamplingBackgroundService> _logger;

    public MetricsSamplingBackgroundService(
        IServiceScopeFactory scopeFactory,
        ISystemMetricsCollector collector,
        ILogger<MetricsSamplingBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _collector = collector;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var executedAt = DateTimeOffset.UtcNow;

        _logger.LogInformation("Metrics sampling background service started at {ExecutedAt}.", executedAt);

        await CollectAndPersistAsync(stoppingToken);

        using var timer = new PeriodicTimer(SamplingInterval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await CollectAndPersistAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Metrics sampling background service stopped.");
        }
    }

    private async Task CollectAndPersistAsync(CancellationToken cancellationToken)
    {
        try
        {
            var metric = await _collector.CollectAsync(cancellationToken);

            await using var scope = _scopeFactory.CreateAsyncScope();
            var metricsRepository = scope.ServiceProvider.GetRequiredService<ISystemMetricsRepository>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            await metricsRepository.SaveAsync(metric, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            if (metric.Status == MetricCollectionStatus.Success)
            {
                _logger.LogDebug(
                    "Metrics sample persisted at {CollectedAtUtc}. CPU: {CpuUsagePercent}, RAM: {RamUsagePercent}",
                    metric.CollectedAtUtc,
                    metric.CpuUsagePercent,
                    metric.RamUsagePercent);
            }
            else
            {
                _logger.LogWarning(
                    "Failed metrics read persisted at {CollectedAtUtc}. Reason: {FailureReason}",
                    metric.CollectedAtUtc,
                    metric.FailureReason);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during metrics collection cycle.");
        }
    }
}