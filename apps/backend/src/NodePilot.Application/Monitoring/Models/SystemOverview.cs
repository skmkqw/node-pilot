namespace NodePilot.Application.Monitoring.Models;

/// <summary>
/// Live, on-demand snapshot of host information that is not persisted as a time series.
/// Optional parts are <c>null</c> when disabled in settings or unavailable on the host.
/// </summary>
public sealed record SystemOverview(
    string Hostname,
    string OperatingSystem,
    string Architecture,
    int ProcessorCount,
    double? UptimeSeconds,
    LoadAverage? LoadAverage,
    MemoryInfo? Memory,
    double? CpuTemperatureCelsius,
    DiskUsage? Disk,
    DateTime CollectedAtUtc);

public sealed record LoadAverage(double OneMinute, double FiveMinutes, double FifteenMinutes);

public sealed record DiskUsage(
    string MountPoint,
    long TotalBytes,
    long UsedBytes,
    long AvailableBytes,
    double UsagePercent);

public sealed record TemperatureSensor(string Name, string RawValue);
