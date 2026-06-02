using ErrorOr;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Monitoring.Services;

public sealed class SystemMetricsProvider : ISystemMetricsProvider
{
    private static readonly TimeSpan MaxHistoryRange = TimeSpan.FromDays(7);

    private const int MinimumBucketSizeSeconds = 5;

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

    public async Task<ErrorOr<IReadOnlyList<IntervalMetricsSummary>>> GetHistoricalMetricsAsync(
        DateTime start,
        DateTime end,
        int? minBucketSizeSeconds,
        CancellationToken ct = default)
    {
        var validation = ValidateHistoricalQuery(start, end, minBucketSizeSeconds);

        if (validation.IsError)
        {
            return validation.Errors;
        }

        var normalizedEnd = end > DateTimeOffset.UtcNow
            ? DateTime.UtcNow
            : end;

        var metrics = await _metricsRepository.GetHistoricalAsync(start, normalizedEnd, ct);

        if (metrics.Count == 0)
        {
            return new List<IntervalMetricsSummary>();
        }

        var intervalSeconds =
            minBucketSizeSeconds ?? MinimumBucketSizeSeconds;

        var buckets = BucketByInterval(metrics, intervalSeconds);
        var summaries = GetIntervalSummaries(buckets);

        return summaries;
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

        if (minIntervalSeconds is < MinimumBucketSizeSeconds)
        {
            return Error.Validation(
                code: "SystemMetrics.History.InvalidInterval",
                description: $"'minIntervalSeconds' must be at least {MinimumBucketSizeSeconds}.");
        }

        return Result.Success;
    }

    private static IReadOnlyList<MetricsBucket> BucketByInterval(
        IEnumerable<SystemMetric> metrics,
        int intervalSeconds)
    {
        return metrics
            .OrderBy(x => x.CollectedAtUtc)
            .GroupBy(x =>
            {
                DateTime.SpecifyKind(x.CollectedAtUtc, DateTimeKind.Utc);

                var unixSeconds =
                    new DateTimeOffset(x.CollectedAtUtc)
                        .ToUnixTimeSeconds();

                return unixSeconds / intervalSeconds;
            })
            .Select(group =>
            {
                var bucketKey = group.Key;

                var bucketStartUnix =
                    bucketKey * intervalSeconds;

                var bucketStart =
                    DateTimeOffset.FromUnixTimeSeconds(bucketStartUnix);

                return new MetricsBucket
                {
                    Start = bucketStart,
                    End = bucketStart.AddSeconds(intervalSeconds),
                    Samples = group.ToList()
                };
            })
            .ToList();
    }

    private static List<IntervalMetricsSummary> GetIntervalSummaries(IEnumerable<MetricsBucket> buckets)
    {
        return buckets
            .Select(bucket => bucket.ToSummary())
            .ToList();
    }
}
