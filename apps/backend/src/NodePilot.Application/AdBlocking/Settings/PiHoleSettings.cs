namespace NodePilot.Application.AdBlocking.Settings;

public sealed class PiHoleSettings
{
    public const string SectionName = "PiHole";

    /// <summary>Base URL of the Pi-hole v6 web server, e.g. <c>http://192.168.1.2</c>. Empty disables the integration.</summary>
    public string BaseUrl { get; init; } = string.Empty;

    /// <summary>Pi-hole web/app password. Empty when the Pi-hole API is not password protected.</summary>
    public string Password { get; init; } = string.Empty;

    public int RequestTimeoutSeconds { get; init; } = 5;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(BaseUrl);
}
