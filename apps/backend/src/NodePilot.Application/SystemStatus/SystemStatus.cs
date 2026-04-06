namespace NodePilot.Application.SystemStatus;

public sealed class SystemStatus
{
    public double CpuUsagePercent { get; init; }
    public double RamUsagePercent { get; init; }
    public long TotalMemoryBytes { get; init; }
    public long UsedMemoryBytes { get; init; }
    public long AvailableMemoryBytes { get; init; }
    public DateTimeOffset CollectedAtUtc { get; init; }
}