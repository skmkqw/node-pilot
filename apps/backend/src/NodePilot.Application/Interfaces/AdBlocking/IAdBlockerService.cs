using ErrorOr;
using NodePilot.Application.AdBlocking.Models;
using NodePilot.Application.AdBlocking.Settings;

namespace NodePilot.Application.Interfaces.AdBlocking;

public interface IAdBlockerService
{
    /// <summary>Never fails: an unreachable blocker is reported through the status itself.</summary>
    Task<AdBlockerStatus> GetStatusAsync(CancellationToken ct = default);

    /// <param name="durationSeconds">For a temporary change; <c>null</c> makes it permanent.</param>
    Task<ErrorOr<AdBlockerStatus>> SetBlockingAsync(
        bool enabled,
        int? durationSeconds,
        CancellationToken ct = default);

    /// <summary>
    /// Checks the given (not yet saved) connection settings with a throwaway session.
    /// </summary>
    Task<AdBlockerStatus> TestConnectionAsync(PiHoleSettings candidate, CancellationToken ct = default);
}
