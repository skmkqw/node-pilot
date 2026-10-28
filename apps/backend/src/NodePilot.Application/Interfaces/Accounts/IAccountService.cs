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
}
