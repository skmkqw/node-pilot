namespace NodePilot.Application.Monitoring;

public readonly record struct MemoryInfo(
    long TotalMemoryBytes,
    long UsedMemoryBytes,
    long AvailableMemoryBytes,
    double RamUsagePercent
);