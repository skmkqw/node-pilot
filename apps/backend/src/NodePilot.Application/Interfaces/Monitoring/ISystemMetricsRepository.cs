using NodePilot.Application.Monitoring;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemMetricsRepository
{
    public Task<SystemMetric?> GetLatestSuccessfulAsync(CancellationToken ct = default);

    public Task<List<SystemMetric>> GetHistoricalAsync(DateTime start, DateTime end, CancellationToken ct = default);
    
    public Task SaveAsync(SystemMetric systemMetric, CancellationToken ct = default);
}