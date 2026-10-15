using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;
using NodePilot.Application.Monitoring.Services;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class SystemMetricsProviderTests
{
    [Test]
    public async Task GetHistoricalMetrics_UnspecifiedKindTimestamps_AreBucketedAsUtc()
    {
        // SQLite hands timestamps back with DateTimeKind.Unspecified. Bucketing used to treat
        // them as local time, shifting every bucket by the host's UTC offset.
        var now = DateTime.UtcNow;
        var collectedAt = DateTime.SpecifyKind(
            new DateTime(now.Year, now.Month, now.Day, now.Hour, now.Minute, 0).AddMinutes(-5).AddSeconds(10),
            DateTimeKind.Unspecified);

        var repository = new FakeRepository(
        [
            Sample(collectedAt, cpu: 10),
            Sample(collectedAt.AddSeconds(15), cpu: 30),
        ]);

        var provider = new SystemMetricsProvider(repository);

        var result = await provider.GetHistoricalMetricsAsync(now.AddMinutes(-10), now, minBucketSizeSeconds: 60);

        Assert.That(result.IsError, Is.False);
        Assert.That(result.Value, Has.Count.EqualTo(1));

        var bucket = result.Value[0];
        var expectedStart = new DateTimeOffset(DateTime.SpecifyKind(collectedAt.AddSeconds(-10), DateTimeKind.Utc));

        Assert.That(bucket.IntervalStart, Is.EqualTo(expectedStart));
        Assert.That(bucket.IntervalStart.Offset, Is.EqualTo(TimeSpan.Zero));
        Assert.That(bucket.AverageCpuUsagePercent, Is.EqualTo(20));
        Assert.That(bucket.MinCpuUsagePercent, Is.EqualTo(10));
        Assert.That(bucket.MaxCpuUsagePercent, Is.EqualTo(30));
    }

    [Test]
    public async Task GetHistoricalMetrics_RangeOverSevenDays_ReturnsValidationError()
    {
        var provider = new SystemMetricsProvider(new FakeRepository([]));
        var end = DateTime.UtcNow;

        var result = await provider.GetHistoricalMetricsAsync(end.AddDays(-8), end, null);

        Assert.That(result.FirstError.Code, Is.EqualTo("SystemMetrics.History.RangeTooLarge"));
    }

    private static SystemMetric Sample(DateTime collectedAt, double cpu) => new()
    {
        CpuEnabled = true,
        CpuUsagePercent = cpu,
        RamEnabled = true,
        RamUsagePercent = 50,
        Status = MetricCollectionStatus.Success,
        TotalReads = 2,
        SuccessfulReads = 2,
        CollectedAtUtc = collectedAt,
    };

    private sealed class FakeRepository(List<SystemMetric> metrics) : ISystemMetricsRepository
    {
        public Task<SystemMetric?> GetLatestSuccessfulAsync(CancellationToken ct = default) =>
            Task.FromResult(metrics.LastOrDefault());

        public Task<List<SystemMetric>> GetHistoricalAsync(DateTime start, DateTime end, CancellationToken ct = default) =>
            Task.FromResult(metrics);

        public Task SaveAsync(SystemMetric systemMetric, CancellationToken ct = default) => Task.CompletedTask;

        public Task<int> DeleteOlderThanAsync(DateTime cutoffUtc, CancellationToken ct = default) => Task.FromResult(0);
    }
}
