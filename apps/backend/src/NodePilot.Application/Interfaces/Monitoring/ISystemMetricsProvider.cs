using ErrorOr;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemMetricsProvider
{
    Task<ErrorOr<SystemMetric>> GetCurrentMetricsAsync(CancellationToken ct = default);

    Task<ErrorOr<IReadOnlyList<IntervalMetricsSummary>>> GetHistoricalMetricsAsync(DateTime start, DateTime end, int? minIntervalSeconds, CancellationToken ct = default);
}

