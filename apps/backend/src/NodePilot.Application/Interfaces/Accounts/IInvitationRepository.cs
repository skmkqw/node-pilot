using NodePilot.Application.Accounts.Models;

namespace NodePilot.Application.Interfaces.Accounts;

public interface IInvitationRepository
{
    Task<Invitation?> GetByIdAsync(int id, CancellationToken ct = default);

    /// <summary>Includes <see cref="Invitation.CreatedBy"/>.</summary>
    Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);

    /// <summary>Not yet accepted and not expired, newest first, including <see cref="Invitation.CreatedBy"/>.</summary>
    Task<IReadOnlyList<Invitation>> ListPendingAsync(DateTime nowUtc, CancellationToken ct = default);

    Task AddAsync(Invitation invitation, CancellationToken ct = default);

    void Remove(Invitation invitation);

    /// <summary>Deletes links that expired without being used.</summary>
    Task RemoveExpiredAsync(DateTime nowUtc, CancellationToken ct = default);
}
