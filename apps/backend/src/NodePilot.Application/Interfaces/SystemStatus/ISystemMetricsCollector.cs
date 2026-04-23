using NodePilot.Application.SystemStatus;

namespace NodePilot.Application.Interfaces.SystemStatus;

public interface ISystemMetricsCollector
{
    Task<SystemMetric> CollectAsync(CancellationToken cancellationToken = default);
}