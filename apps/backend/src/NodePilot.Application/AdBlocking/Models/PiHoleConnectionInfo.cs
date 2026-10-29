namespace NodePilot.Application.AdBlocking.Models;

public enum PiHoleSettingsSource
{
    /// <summary>Pi-hole is not connected.</summary>
    None,

    /// <summary>Configured from the NodePilot settings screen (stored in the database).</summary>
    App,

    /// <summary>Configured through environment variables / appsettings (read-only in the UI).</summary>
    Environment,
}

/// <summary>What the settings screen may show. The password itself is never returned.</summary>
public sealed record PiHoleConnectionInfo(string? BaseUrl, bool HasPassword, PiHoleSettingsSource Source);
