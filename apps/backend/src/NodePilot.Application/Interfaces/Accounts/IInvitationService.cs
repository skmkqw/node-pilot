using ErrorOr;
using NodePilot.Application.Accounts.Models;

namespace NodePilot.Application.Interfaces.Accounts;

public interface IInvitationService
{
    Task<ErrorOr<CreatedInvitation>> CreateAsync(int createdByUserId, UserRole role, int validForHours, CancellationToken ct = default);

    Task<IReadOnlyList<InvitationSummary>> ListPendingAsync(CancellationToken ct = default);

    Task<ErrorOr<Deleted>> RevokeAsync(int invitationId, CancellationToken ct = default);

    Task<ErrorOr<InvitationPreview>> PreviewAsync(string? token, CancellationToken ct = default);

    /// <summary>Creates the account and marks the link as used. A link works only once.</summary>
    Task<ErrorOr<UserAccount>> AcceptAsync(string? token, string? username, string? password, CancellationToken ct = default);
}
