using System.Text.RegularExpressions;
using ErrorOr;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Accounts.Errors;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Application.Interfaces.Security;

namespace NodePilot.Application.Accounts.Services;

public sealed partial class AccountService : IAccountService
{
    public const int MinPasswordLength = 8;
    public const int MaxPasswordLength = 128;

    // Only one first-start setup may run at a time, otherwise two concurrent requests
    // could both see "no account yet" and create two administrators.
    private static readonly SemaphoreSlim _setupGate = new(1, 1);

    // Hash compared against when the username does not exist, so a login attempt takes
    // the same time whether or not the account exists (no username enumeration).
    private readonly Lazy<string> _dummyHash;

    private readonly IUserAccountRepository _accounts;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<AccountService> _logger;

    public AccountService(
        IUserAccountRepository accounts,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        ILogger<AccountService> logger)
    {
        _accounts = accounts;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _logger = logger;
        _dummyHash = new Lazy<string>(() => _passwordHasher.Hash(Guid.NewGuid().ToString()));
    }

    public async Task<bool> IsSetupRequiredAsync(CancellationToken ct = default)
    {
        return !await _accounts.AnyAsync(ct);
    }

    public async Task<ErrorOr<UserAccount>> CreateInitialAdminAsync(
        string? username,
        string? password,
        CancellationToken ct = default)
    {
        // Once an administrator exists, setup is closed regardless of what was sent.
        if (await _accounts.AnyAsync(ct))
        {
            return AccountErrors.SetupAlreadyCompleted;
        }

        var validation = Validate(username, password);

        if (validation.IsError)
        {
            return validation.Errors;
        }

        await _setupGate.WaitAsync(ct);

        try
        {
            if (await _accounts.AnyAsync(ct))
            {
                return AccountErrors.SetupAlreadyCompleted;
            }

            var now = DateTime.UtcNow;
            var account = new UserAccount
            {
                Username = username!.Trim(),
                PasswordHash = _passwordHasher.Hash(password!),
                CreatedAtUtc = now,
                PasswordChangedAtUtc = now,
            };

            await _accounts.AddAsync(account, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            _logger.LogInformation("Administrator account '{Username}' created during first-start setup.", account.Username);

            return account;
        }
        finally
        {
            _setupGate.Release();
        }
    }

    public async Task<ErrorOr<UserAccount>> ValidateCredentialsAsync(
        string? username,
        string? password,
        CancellationToken ct = default)
    {
        var account = string.IsNullOrWhiteSpace(username)
            ? null
            : await _accounts.GetByUsernameAsync(username.Trim(), ct);

        var verification = _passwordHasher.Verify(account?.PasswordHash ?? _dummyHash.Value, password ?? string.Empty);

        if (account is null || verification == PasswordVerification.Failed)
        {
            return AccountErrors.InvalidCredentials;
        }

        if (verification == PasswordVerification.SuccessRehashNeeded)
        {
            account.PasswordHash = _passwordHasher.Hash(password!);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        return account;
    }

    public async Task<ErrorOr<Success>> ChangePasswordAsync(
        int accountId,
        string? currentPassword,
        string? newPassword,
        CancellationToken ct = default)
    {
        if (!IsValidPassword(newPassword))
        {
            return AccountErrors.WeakPassword;
        }

        var account = await _accounts.GetByIdAsync(accountId, ct);

        if (account is null)
        {
            return AccountErrors.NotFound;
        }

        if (_passwordHasher.Verify(account.PasswordHash, currentPassword ?? string.Empty) == PasswordVerification.Failed)
        {
            return AccountErrors.CurrentPasswordIncorrect;
        }

        account.PasswordHash = _passwordHasher.Hash(newPassword!);
        account.PasswordChangedAtUtc = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("Password changed for '{Username}'.", account.Username);

        return Result.Success;
    }

    public static bool IsValidUsername(string? username)
    {
        return username is not null && UsernamePattern().IsMatch(username.Trim());
    }

    public static bool IsValidPassword(string? password)
    {
        return password is { Length: >= MinPasswordLength and <= MaxPasswordLength }
            && !string.IsNullOrWhiteSpace(password);
    }

    private static ErrorOr<Success> Validate(string? username, string? password)
    {
        var errors = new List<Error>();

        if (!IsValidUsername(username))
        {
            errors.Add(AccountErrors.InvalidUsername);
        }

        if (!IsValidPassword(password))
        {
            errors.Add(AccountErrors.WeakPassword);
        }

        return errors.Count > 0 ? errors : Result.Success;
    }

    [GeneratedRegex("^[A-Za-z0-9._-]{3,32}$")]
    private static partial Regex UsernamePattern();
}
