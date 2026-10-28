namespace NodePilot.Api.Auth;

/// <summary>
/// Session options. The administrator account itself is created in the app on first start
/// and stored in the database, so no credentials are configured here.
/// </summary>
public sealed class AuthSettings
{
    public const string SectionName = "Auth";

    public int SessionLifetimeHours { get; init; } = 168;
}
