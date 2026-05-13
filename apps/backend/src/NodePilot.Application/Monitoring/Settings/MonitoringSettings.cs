namespace NodePilot.Application.Monitoring.Settings;


public sealed class MonitoringSettings
{
    public CollectionSettings Collection { get; init; } = new();

    public RetentionSettings Retention { get; init; } = new();

    // NOT USED 
    public AlertingSettings Alerts { get; init; } = new();
}