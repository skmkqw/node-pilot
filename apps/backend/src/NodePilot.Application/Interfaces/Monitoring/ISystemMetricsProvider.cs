using ErrorOr;
using NodePilot.Application.Monitoring;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemMetricsProvider
{
    public Task<ErrorOr<SystemMetric>> GetCurrentMetricsAsync(CancellationToken ct = default);

    public Task<ErrorOr<List<SystemMetric>>> GetHistoricalMetricsAsync(DateTime start, DateTime end, int? minIntervalSeconds, CancellationToken ct = default);
}

