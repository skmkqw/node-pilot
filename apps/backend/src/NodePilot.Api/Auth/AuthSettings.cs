namespace NodePilot.Api.Auth;

/// <summary>
/// Credentials of the single NodePilot administrator. The password is expected to come
/// from the environment (<c>Auth__Password</c>) and is never stored in appsettings.
/// </summary>
public sealed class AuthSettings
{
    public const string SectionName = "Auth";

    public const int MinimumPasswordLength = 8;

    public string Username { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public int SessionLifetimeHours { get; init; }
}
