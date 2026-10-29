namespace NodePilot.Application.Accounts.Models;

/// <summary>
/// A NodePilot user. The first administrator is created through the first-start setup screen,
/// everyone else through an invitation link. Only a salted hash of the password is stored.
/// </summary>
public sealed class UserAccount
{
    public int Id { get; init; }

    public string Username { get; init; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; } = UserRole.Member;

    public DateTime CreatedAtUtc { get; init; }

    public DateTime PasswordChangedAtUtc { get; set; }
}
