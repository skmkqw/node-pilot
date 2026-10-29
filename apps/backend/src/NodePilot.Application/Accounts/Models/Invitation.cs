namespace NodePilot.Application.Accounts.Models;

/// <summary>
/// A one-time link that lets someone create their own account. Only a SHA-256 hash of the
/// token is stored, so the link cannot be recovered from the database.
/// </summary>
public sealed class Invitation
{
    public int Id { get; init; }

    public string TokenHash { get; init; } = string.Empty;

    public UserRole Role { get; init; }

    public int CreatedByUserId { get; init; }

    public UserAccount? CreatedBy { get; init; }

    public DateTime CreatedAtUtc { get; init; }

    public DateTime ExpiresAtUtc { get; init; }

    public DateTime? AcceptedAtUtc { get; set; }

    public bool IsUsable(DateTime nowUtc) => AcceptedAtUtc is null && ExpiresAtUtc > nowUtc;
}
