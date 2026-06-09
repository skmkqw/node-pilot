using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemMetricsCollector
{
    Task<SystemMetric> CollectAsync(CancellationToken cancellationToken = default);
}
