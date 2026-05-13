namespace NodePilot.Application.Monitoring.Settings;


public sealed class CollectionSettings
{
    // USED
    public int IntervalSeconds { get; init; } = 5;

    public bool Enabled { get; init; } = true;

    public bool CollectCpuUsage { get; init; } = true;

    public bool CollectRamUsage { get; init; } = true;


    // NOT USED
    public bool CollectDiskUsage { get; init; } = true;

    public bool CollectTemperature { get; init; } = true;
}