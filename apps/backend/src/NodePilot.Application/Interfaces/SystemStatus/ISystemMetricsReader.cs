using ErrorOr;

namespace NodePilot.Application.Interfaces.SystemStatus;

public interface ISystemMetricsReader
{
    Task<ErrorOr<Application.SystemStatus.SystemStatus>> ReadSystemStatusAsync(CancellationToken cancellationToken = default);
}