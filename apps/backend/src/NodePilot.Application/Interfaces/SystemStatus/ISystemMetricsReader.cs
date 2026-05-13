using ErrorOr;
using NodePilot.Application.Monitoring;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemMetricsReader
{
    Task<ErrorOr<SystemStatus>> ReadSystemStatusAsync(CancellationToken cancellationToken = default);
}