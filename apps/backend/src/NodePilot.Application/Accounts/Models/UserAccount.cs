namespace NodePilot.Application.Accounts.Models;

/// <summary>
/// The NodePilot administrator. Created through the first-start setup screen;
/// only a salted hash of the password is stored.
/// </summary>
public sealed class UserAccount
{
    public int Id { get; init; }

    public string Username { get; init; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; init; }

    public DateTime PasswordChangedAtUtc { get; set; }
}
