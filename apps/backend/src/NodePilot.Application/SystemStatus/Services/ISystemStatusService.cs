using ErrorOr;

namespace NodePilot.Application.SystemStatus.Services;

public interface ISystemStatusService
{
    Task<ErrorOr<SystemStatus>> GetSystemStatusAsync(CancellationToken cancellationToken = default);
}