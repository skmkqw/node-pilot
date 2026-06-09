namespace NodePilot.Application.Monitoring.Models;

public sealed class MetricsBucket
{
    public DateTimeOffset Start { get; init; }

    public DateTimeOffset End { get; init; }

    public IReadOnlyList<SystemMetric> Samples { get; init; } = [];

    public int Count => Samples.Count;

    public IntervalMetricsSummary ToSummary() => new(this);
}
