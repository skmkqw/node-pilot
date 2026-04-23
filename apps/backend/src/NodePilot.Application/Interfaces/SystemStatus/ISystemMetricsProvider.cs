using ErrorOr;
using NodePilot.Application.SystemStatus;

namespace NodePilot.Application.Interfaces.SystemStatus;

public interface ISystemMetricsProvider
{
    public Task<ErrorOr<SystemMetric>> GetCurrentMetricsAsync(CancellationToken ct = default);

    public Task<ErrorOr<List<SystemMetric>>> GetHistoricalMetricsAsync(DateTime start, DateTime end, int? minIntervalSeconds, CancellationToken ct = default);
}

