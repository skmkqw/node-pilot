using ErrorOr;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Interfaces.SystemStatus;

namespace NodePilot.Application.SystemStatus.Services;

public sealed class LinuxSystemMetricsCollector : ISystemMetricsCollector
{
    private readonly ISystemMetricsReader _metricsReader;

    private readonly ILogger<LinuxSystemMetricsCollector> _logger;

    public LinuxSystemMetricsCollector(ILogger<LinuxSystemMetricsCollector> logger, ISystemMetricsReader metricsReader)
    {
        _logger = logger;
        _metricsReader = metricsReader;
    }

    public async Task<SystemMetric> CollectAsync(CancellationToken cancellationToken = default)
    {
        var collectedAtUtc = DateTimeOffset.UtcNow;

        var readSystemMetricsResult = await _metricsReader.ReadSystemStatusAsync(cancellationToken);

        if (readSystemMetricsResult.IsError)
        {
            return CreateReadFailedMetric(
                collectedAtUtc,
                BuildFailureReason(readSystemMetricsResult.Errors));
        }

        var systemMetrics = readSystemMetricsResult.Value;

        return new SystemMetric
        {
            CpuUsagePercent = Math.Round(systemMetrics.CpuUsagePercent, 2),
            RamUsagePercent = Math.Round(systemMetrics.RamUsagePercent, 2),
            Status = MetricCollectionStatus.Success,
            FailureReason = null,
            CollectedAtUtc = collectedAtUtc
        };
    }

    private SystemMetric CreateReadFailedMetric(DateTimeOffset collectedAtUtc, string failureReason)
    {
        _logger.LogWarning(
            "System metrics collection failed at {CollectedAtUtc}. Reason: {FailureReason}",
            collectedAtUtc,
            failureReason);

        return new SystemMetric
        {
            CpuUsagePercent = null,
            RamUsagePercent = null,
            Status = MetricCollectionStatus.ReadFailed,
            FailureReason = failureReason,
            CollectedAtUtc = collectedAtUtc
        };
    }

    private static string BuildFailureReason(List<Error> errors)
    {
        var first = errors.FirstOrDefault();
        
        return string.IsNullOrWhiteSpace(first.Code)
            ? "unknown_error"
            : first.Code[..Math.Min(first.Code.Length, 500)];
    }
}