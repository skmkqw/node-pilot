namespace NodePilot.Application.Monitoring.Models;

public readonly record struct MemoryInfo(
    long TotalMemoryBytes,
    long UsedMemoryBytes,
    long AvailableMemoryBytes,
    double RamUsagePercent
);
