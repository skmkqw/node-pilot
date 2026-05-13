using Microsoft.Extensions.Configuration;

namespace NodePilot.Application.Monitoring.Settings;


public sealed class CollectionSettings
{
    // USED
    [ConfigurationKeyName("IntervalSeconds")]
    public int IntervalSeconds { get; init; }
    
    [ConfigurationKeyName("Enabled")]
    public bool Enabled { get; init; }

    [ConfigurationKeyName("CollectCpuUsage")]
    public bool CollectCpuUsage { get; init; }

    [ConfigurationKeyName("CollectRamUsage")]
    public bool CollectRamUsage { get; init; }


    // NOT USED
    [ConfigurationKeyName("CollectDiskUsage")]
    public bool CollectDiskUsage { get; init; }

    [ConfigurationKeyName("CollectTemperature")]
    public bool CollectTemperature { get; init; }
}