using NodePilot.Application.SystemStatus;

namespace NodePilot.Application.Interfaces.SystemStatus;

public interface ISystemMetricsRepository
{
    public Task SaveAsync(SystemMetric systemMetric, CancellationToken ct = default);
}