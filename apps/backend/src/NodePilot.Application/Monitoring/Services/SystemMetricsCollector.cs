using ErrorOr;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Monitoring.Services;

public sealed class LinuxSystemMetricsCollector : ISystemMetricsCollector
{
    private readonly ISystemMetricsReader _metricsReader;
    private readonly IMonitoringSettingsProvider _monitoringSettingsProvider;
    private readonly ILogger<LinuxSystemMetricsCollector> _logger;

    public LinuxSystemMetricsCollector(
        ISystemMetricsReader metricsReader,
        IMonitoringSettingsProvider monitoringSettingsProvider,
        ILogger<LinuxSystemMetricsCollector> logger)
    {
        _metricsReader = metricsReader;
        _monitoringSettingsProvider = monitoringSettingsProvider;
        _logger = logger;
    }

    public async Task<SystemMetric> CollectAsync(
        CancellationToken cancellationToken = default)
    {
        var settings = _monitoringSettingsProvider.Current.Collection;
        var collectedAtUtc = DateTime.UtcNow;

        var errors = new List<Error>();

        int totalReads = 0;
        int failedReads = 0;

        double? cpuUsage = null;

        if (settings.CollectCpuUsage)
        {
            totalReads++;

            var result = await _metricsReader.ReadCpuUsagePercentAsync(cancellationToken);

            if (result.IsError)
            {
                failedReads++;
                errors.AddRange(result.Errors);
            }
            else
            {
                cpuUsage = Math.Round(result.Value, 2);
            }
        }

        double? ramUsage = null;

        if (settings.CollectRamUsage)
        {
            totalReads++;

            var result = _metricsReader.ReadMemoryInfo();

            if (result.IsError)
            {
                failedReads++;
                errors.AddRange(result.Errors);
            }
            else
            {
                ramUsage = Math.Round(result.Value.RamUsagePercent, 2);
            }
        }

        var status = DetermineStatus(totalReads, failedReads);
        var failureReason = errors.Count > 0
            ? BuildFailureReason(errors)
            : null;

        LogCollectionResult(status, collectedAtUtc, totalReads, failedReads, failureReason);

        return new SystemMetric
        {
            CpuEnabled = settings.CollectCpuUsage,
            RamEnabled = settings.CollectRamUsage,

            CpuUsagePercent = cpuUsage,
            RamUsagePercent = ramUsage,

            Status = status,
            TotalReads = totalReads,
            SuccessfulReads = totalReads - failedReads,
            FailureReason = failureReason,

            CollectedAtUtc = collectedAtUtc
        };
    }

    private void LogCollectionResult(
        MetricCollectionStatus status,
        DateTime collectedAtUtc,
        int totalReads,
        int failedReads,
        string? failureReason)
    {
        switch (status)
        {
            case MetricCollectionStatus.Success:
                _logger.LogDebug(
                    "System metrics collection succeeded at {CollectedAtUtc}.",
                    collectedAtUtc);

                return;

            case MetricCollectionStatus.PartialSuccess:
                _logger.LogWarning(
                    "System metrics collection partially failed at {CollectedAtUtc}. Total reads: {TotalReads}. Failed reads: {FailedReads} Reason: {FailureReason}",
                    collectedAtUtc,
                    totalReads,
                    failedReads,
                    failureReason);

                return;

            case MetricCollectionStatus.ReadFailed:
                _logger.LogWarning(
                    "System metrics collection failed at {CollectedAtUtc}. Reads failed: {FailedReads}. Reason: {FailureReason}",
                    collectedAtUtc,
                    failedReads,
                    failureReason);

                return;
        }
    }

    private static MetricCollectionStatus DetermineStatus(
        int totalReads,
        int failedReads)
    {
        if (totalReads == 0)
        {
            return MetricCollectionStatus.Success;
        }

        if (failedReads == 0)
        {
            return MetricCollectionStatus.Success;
        }

        if (failedReads == totalReads)
        {
            return MetricCollectionStatus.ReadFailed;
        }

        return MetricCollectionStatus.PartialSuccess;
    }

    private static string BuildFailureReason(List<Error> errors)
    {
        var first = errors.FirstOrDefault();

        return string.IsNullOrWhiteSpace(first.Code)
            ? "unknown_error"
            : first.Code[..Math.Min(first.Code.Length, 500)];
    }
}
