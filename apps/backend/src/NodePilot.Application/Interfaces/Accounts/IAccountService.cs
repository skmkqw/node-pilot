using ErrorOr;
using NodePilot.Application.Accounts.Models;

namespace NodePilot.Application.Interfaces.Accounts;

public interface IAccountService
{
    /// <summary>True until the first administrator account has been created.</summary>
    Task<bool> IsSetupRequiredAsync(CancellationToken ct = default);

    /// <summary>Creates the administrator. Fails once an account exists.</summary>
    Task<ErrorOr<UserAccount>> CreateInitialAdminAsync(string? username, string? password, CancellationToken ct = default);

    Task<ErrorOr<UserAccount>> ValidateCredentialsAsync(string? username, string? password, CancellationToken ct = default);

    Task<ErrorOr<Success>> ChangePasswordAsync(int accountId, string? currentPassword, string? newPassword, CancellationToken ct = default);

    Task<IReadOnlyList<UserSummary>> ListUsersAsync(CancellationToken ct = default);

    /// <summary>Removes another user. Administrators cannot remove themselves, so one always remains.</summary>
    Task<ErrorOr<Deleted>> RemoveUserAsync(int actingUserId, int userId, CancellationToken ct = default);

    /// <summary>Changes another user's role. Administrators cannot demote themselves.</summary>
    Task<ErrorOr<UserSummary>> ChangeRoleAsync(int actingUserId, int userId, UserRole role, CancellationToken ct = default);
}
