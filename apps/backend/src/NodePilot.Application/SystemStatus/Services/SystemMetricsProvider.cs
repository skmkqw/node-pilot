using ErrorOr;
using NodePilot.Application.Interfaces.SystemStatus;

namespace NodePilot.Application.SystemStatus.Services;

public sealed class SystemMetricsProvider : ISystemMetricsProvider
{
    private static readonly TimeSpan MaxHistoryRange = TimeSpan.FromDays(7);
    private const int MinimumSamplingIntervalSeconds = 5;

    private readonly ISystemMetricsRepository _metricsRepository;

    public SystemMetricsProvider(ISystemMetricsRepository metricsRepository)
    {
        _metricsRepository = metricsRepository;
    }

    public async Task<ErrorOr<SystemMetric>> GetCurrentMetricsAsync(CancellationToken ct = default)
    {
        var latestMetric = await _metricsRepository.GetLatestSuccessfulAsync(ct);

        if (latestMetric is null)
        {
            return Error.NotFound(
                code: "SystemMetrics.Current.NotFound",
                description: "No successful system metrics samples are available.");
        }

        return latestMetric;
    }

    public async Task<ErrorOr<List<SystemMetric>>> GetHistoricalMetricsAsync(
        DateTime start,
        DateTime end,
        int? minIntervalSeconds,
        CancellationToken ct = default)
    {
        var validation = ValidateHistoricalQuery(start, end, minIntervalSeconds);

        if (validation.IsError)
        {
            return validation.Errors;
        }

        var normalizedEnd = end > DateTimeOffset.UtcNow
            ? DateTime.UtcNow
            : end;

        var metrics = await _metricsRepository.GetHistoricalAsync(start, normalizedEnd, ct);

        if (minIntervalSeconds is null)
        {
            return metrics;
        }

        var downsampled = DownsampleByMinimumInterval(metrics, minIntervalSeconds.Value);
        return downsampled;
    }

    private static ErrorOr<Success> ValidateHistoricalQuery(
        DateTimeOffset start,
        DateTimeOffset end,
        int? minIntervalSeconds)
    {
        if (start >= end)
        {
            return Error.Validation(
                code: "SystemMetrics.History.InvalidRange",
                description: "'start' must be earlier than 'end'.");
        }

        var now = DateTimeOffset.UtcNow;

        if (start > now)
        {
            return Error.Validation(
                code: "SystemMetrics.History.StartInFuture",
                description: "'start' cannot be in the future.");
        }

        if (end - start > MaxHistoryRange)
        {
            return Error.Validation(
                code: "SystemMetrics.History.RangeTooLarge",
                description: $"Requested history range cannot exceed {MaxHistoryRange.TotalDays:0} days.");
        }

        if (minIntervalSeconds is < MinimumSamplingIntervalSeconds)
        {
            return Error.Validation(
                code: "SystemMetrics.History.InvalidInterval",
                description: $"'minIntervalSeconds' must be at least {MinimumSamplingIntervalSeconds}.");
        }

        return Result.Success;
    }

    private static List<SystemMetric> DownsampleByMinimumInterval(
        List<SystemMetric> metrics,
        int minIntervalSeconds)
    {
        if (metrics.Count <= 1)
        {
            return metrics;
        }

        var result = new List<SystemMetric>(capacity: metrics.Count);
        DateTimeOffset? lastIncludedAt = null;

        foreach (var metric in metrics.OrderBy(x => x.CollectedAtUtc))
        {
            if (lastIncludedAt is null ||
                (metric.CollectedAtUtc - lastIncludedAt.Value).TotalSeconds >= minIntervalSeconds)
            {
                result.Add(metric);
                lastIncludedAt = metric.CollectedAtUtc;
            }
        }

        return result;
    }
}
