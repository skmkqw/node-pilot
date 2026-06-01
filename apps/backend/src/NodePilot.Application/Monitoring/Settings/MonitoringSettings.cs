using Microsoft.Extensions.Configuration;

namespace NodePilot.Application.Monitoring.Settings;


public sealed class MonitoringSettings
{
    [ConfigurationKeyName("Collection")]
    public CollectionSettings Collection { get; init; } = null!;

    [ConfigurationKeyName("Retention")]
    public RetentionSettings Retention { get; init; } = null!;

    // NOT USED 
    [ConfigurationKeyName("Alerts")]
    public AlertingSettings Alerts { get; init; } = null!;
}