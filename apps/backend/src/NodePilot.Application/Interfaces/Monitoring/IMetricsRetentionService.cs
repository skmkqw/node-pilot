using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface IMetricsRetentionService
{
    Task<RetentionResult> ApplyRetentionAsync(
        TimeSpan retention,
        CancellationToken ct = default);
}
