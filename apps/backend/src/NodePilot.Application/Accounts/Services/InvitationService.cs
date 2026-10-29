using System.Security.Cryptography;
using System.Text;
using ErrorOr;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Accounts.Errors;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Application.Interfaces.Security;

namespace NodePilot.Application.Accounts.Services;

public sealed class InvitationService : IInvitationService
{
    public const int MinLifetimeHours = 1;
    public const int MaxLifetimeHours = 7 * 24;

    // 32 random bytes = 256 bits: guessing a valid link is not feasible.
    private const int _tokenBytes = 32;

    // Accepting is check-then-write (link unused? username free?), so two requests with the
    // same link must not run at the same time, otherwise one link could create two accounts.
    private static readonly SemaphoreSlim _acceptGate = new(1, 1);

    private readonly IInvitationRepository _invitations;
    private readonly IUserAccountRepository _accounts;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly TimeProvider _time;
    private readonly ILogger<InvitationService> _logger;

    public InvitationService(
        IInvitationRepository invitations,
        IUserAccountRepository accounts,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        TimeProvider time,
        ILogger<InvitationService> logger)
    {
        _invitations = invitations;
        _accounts = accounts;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _time = time;
        _logger = logger;
    }

    public async Task<ErrorOr<CreatedInvitation>> CreateAsync(
        int createdByUserId,
        UserRole role,
        int validForHours,
        CancellationToken ct = default)
    {
        if (!Enum.IsDefined(role))
        {
            return AccountErrors.InvalidRole;
        }

        if (validForHours is < MinLifetimeHours or > MaxLifetimeHours)
        {
            return InvitationErrors.InvalidLifetime;
        }

        var now = _time.GetUtcNow().UtcDateTime;
        string token = Base64UrlEncode(RandomNumberGenerator.GetBytes(_tokenBytes));

        var invitation = new Invitation
        {
            TokenHash = HashToken(token),
            Role = role,
            CreatedByUserId = createdByUserId,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddHours(validForHours),
        };

        await _invitations.RemoveExpiredAsync(now, ct);
        await _invitations.AddAsync(invitation, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Invitation {InvitationId} ({Role}, valid for {Hours} h) created by user {UserId}.",
            invitation.Id, role, validForHours, createdByUserId);

        return new CreatedInvitation(invitation.Id, token, role, invitation.ExpiresAtUtc);
    }

    public async Task<IReadOnlyList<InvitationSummary>> ListPendingAsync(CancellationToken ct = default)
    {
        var pending = await _invitations.ListPendingAsync(_time.GetUtcNow().UtcDateTime, ct);

        return pending
            .Select(invitation => new InvitationSummary(
                invitation.Id,
                invitation.Role,
                invitation.CreatedBy?.Username ?? string.Empty,
                invitation.CreatedAtUtc,
                invitation.ExpiresAtUtc))
            .ToList();
    }

    public async Task<ErrorOr<Deleted>> RevokeAsync(int invitationId, CancellationToken ct = default)
    {
        var invitation = await _invitations.GetByIdAsync(invitationId, ct);

        if (invitation is null)
        {
            return InvitationErrors.NotFound;
        }

        _invitations.Remove(invitation);
        await _unitOfWork.SaveChangesAsync(ct);

        return Result.Deleted;
    }

    public async Task<ErrorOr<InvitationPreview>> PreviewAsync(string? token, CancellationToken ct = default)
    {
        var invitation = await FindUsableAsync(token, ct);

        if (invitation is null)
        {
            return InvitationErrors.InvalidOrExpired;
        }

        return new InvitationPreview(invitation.Role, invitation.CreatedBy?.Username ?? string.Empty, invitation.ExpiresAtUtc);
    }

    public async Task<ErrorOr<UserAccount>> AcceptAsync(
        string? token,
        string? username,
        string? password,
        CancellationToken ct = default)
    {
        var validation = AccountService.ValidateNewAccount(username, password);

        if (validation.IsError)
        {
            return validation.Errors;
        }

        await _acceptGate.WaitAsync(ct);

        try
        {
            var invitation = await FindUsableAsync(token, ct);

            if (invitation is null)
            {
                return InvitationErrors.InvalidOrExpired;
            }

            string trimmed = username!.Trim();

            if (await _accounts.GetByUsernameAsync(trimmed, ct) is not null)
            {
                return AccountErrors.UsernameTaken;
            }

            var now = _time.GetUtcNow().UtcDateTime;
            var account = new UserAccount
            {
                Username = trimmed,
                PasswordHash = _passwordHasher.Hash(password!),
                Role = invitation.Role,
                CreatedAtUtc = now,
                PasswordChangedAtUtc = now,
            };

            invitation.AcceptedAtUtc = now;
            await _accounts.AddAsync(account, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Account '{Username}' ({Role}) created from invitation {InvitationId}.",
                account.Username, account.Role, invitation.Id);

            return account;
        }
        finally
        {
            _acceptGate.Release();
        }
    }

    /// <summary>SHA-256 of the token as lowercase hex. Only this value is stored.</summary>
    public static string HashToken(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private async Task<Invitation?> FindUsableAsync(string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 128)
        {
            return null;
        }

        var invitation = await _invitations.GetByTokenHashAsync(HashToken(token.Trim()), ct);

        return invitation is not null && invitation.IsUsable(_time.GetUtcNow().UtcDateTime) ? invitation : null;
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
