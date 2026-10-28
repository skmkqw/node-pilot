using ErrorOr;
using NodePilot.Application.AdBlocking.Models;
using NodePilot.Application.AdBlocking.Settings;

namespace NodePilot.Application.Interfaces.AdBlocking;

/// <summary>
/// Pi-hole connection settings. Values saved from the settings screen take precedence;
/// the <c>PiHole</c> configuration section is only a fallback for automated deployments.
/// </summary>
public interface IPiHoleSettingsStore
{
    Task<PiHoleSettings> GetEffectiveAsync(CancellationToken ct = default);

    Task<PiHoleConnectionInfo> GetInfoAsync(CancellationToken ct = default);

    /// <param name="password"><c>null</c> keeps the currently saved password.</param>
    Task<ErrorOr<PiHoleConnectionInfo>> SaveAsync(string? baseUrl, string? password, CancellationToken ct = default);

    Task ClearAsync(CancellationToken ct = default);
}
