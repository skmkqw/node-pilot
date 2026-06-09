using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemMetricsRepository
{
    Task<SystemMetric?> GetLatestSuccessfulAsync(CancellationToken ct = default);

    Task<List<SystemMetric>> GetHistoricalAsync(DateTime start, DateTime end, CancellationToken ct = default);

    Task SaveAsync(SystemMetric systemMetric, CancellationToken ct = default);

    Task<int> DeleteOlderThanAsync(DateTime cutoffUtc, CancellationToken ct = default);
}
