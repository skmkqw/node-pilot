using Microsoft.Extensions.Configuration;

namespace NodePilot.Application.Monitoring.Settings;


public sealed class RetentionSettings
{
    [ConfigurationKeyName("MaxMetricAgeHours")]
    public int MaxMetricAgeHours { get; init; }

    [ConfigurationKeyName("CleanupIntervalMinutes")]
    public int CleanupIntervalMinutes { get; init; }

    [ConfigurationKeyName("MaxStoredSamples")]
    public int MaxStoredSamples { get; init; }

    [ConfigurationKeyName("CleanupEnabled")]
    public bool CleanupEnabled { get; init; }
}