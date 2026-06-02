using ErrorOr;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemMetricsReader
{
    Task<ErrorOr<double>> ReadCpuUsagePercentAsync(CancellationToken cancellationToken = default);

    ErrorOr<MemoryInfo> ReadMemoryInfo();
}