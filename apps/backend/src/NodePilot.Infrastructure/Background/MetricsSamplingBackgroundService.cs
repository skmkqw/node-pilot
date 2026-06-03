using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Infrastructure.Background;

public sealed class MetricsSamplingBackgroundService : BackgroundService
{
    private readonly MetricsCollectorState _state;

    private readonly IServiceScopeFactory _scopeFactory;

    private readonly ISystemMetricsCollector _collector;

    private readonly IMonitoringSettingsProvider _monitoringSettingsProvider;

    private readonly ILogger<MetricsSamplingBackgroundService> _logger;

    public MetricsSamplingBackgroundService(
        MetricsCollectorState state,
        IServiceScopeFactory scopeFactory,
        ISystemMetricsCollector collector,
        IMonitoringSettingsProvider monitoringSettingsProvider,
        ILogger<MetricsSamplingBackgroundService> logger)
    {
        _state = state;
        _scopeFactory = scopeFactory;
        _collector = collector;
        _monitoringSettingsProvider = monitoringSettingsProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = _monitoringSettingsProvider.Current.Collection;

        if (!settings.Enabled)
        {
            _state.MarkStopped();
            return;
        }

        _state.MarkRunning();

        _logger.LogInformation(
            "Metrics sampling background service started at {StartedAtUtc}.",
            DateTimeOffset.UtcNow);

        try
        {
            await CollectAndPersistAsync(stoppingToken);

            var samplingInterval = TimeSpan.FromSeconds(settings.IntervalSeconds);
            using var timer = new PeriodicTimer(samplingInterval);

            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await CollectAndPersistAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Metrics sampling background service stopped.");
        }
        catch (Exception ex)
        {
            _state.MarkFailure(DateTimeOffset.UtcNow, ex.Message);

            _logger.LogError(
                ex,
                "Metrics sampling background service failed unexpectedly.");
        }
        finally
        {
            _state.MarkStopped();
        }
    }

    private async Task CollectAndPersistAsync(CancellationToken cancellationToken)
    {
        var attemptedAtUtc = DateTimeOffset.UtcNow;

        try
        {
            var metric = await _collector.CollectAsync(cancellationToken);

            await using var scope = _scopeFactory.CreateAsyncScope();
            var metricsRepository = scope.ServiceProvider.GetRequiredService<ISystemMetricsRepository>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            await metricsRepository.SaveAsync(metric, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            if (metric.Status != MetricCollectionStatus.ReadFailed)
            {
                _logger.LogDebug(
                    "Metrics sample persisted at {CollectedAtUtc}. CPU: {CpuUsagePercent}, RAM: {RamUsagePercent}",
                    metric.CollectedAtUtc,
                    metric.CpuUsagePercent,
                    metric.RamUsagePercent);

                _state.MarkSuccess(DateTimeOffset.UtcNow);
            }
            else
            {
                _state.MarkFailure(attemptedAtUtc, metric.FailureReason ?? "unknown_error");

                _logger.LogWarning(
                    "Failed metrics read at {CollectedAtUtc}. Reason: {FailureReason}",
                    metric.CollectedAtUtc,
                    metric.FailureReason);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _state.MarkFailure(attemptedAtUtc, ex.Message);

            _logger.LogWarning(
                ex,
                "Metrics sampling attempt failed at {AttemptedAtUtc}.",
                attemptedAtUtc);
        }
    }
}
