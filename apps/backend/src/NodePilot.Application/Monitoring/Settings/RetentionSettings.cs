namespace NodePilot.Application.Monitoring.Settings;


public sealed class RetentionSettings
{
    public int MaxMetricAgeHours { get; init; } = 24;

    public int CleanupIntervalMinutes { get; init; } = 30;

    public int MaxStoredSamples { get; init; } = 100_000;

    public bool CleanupEnabled { get; init; } = true;
}