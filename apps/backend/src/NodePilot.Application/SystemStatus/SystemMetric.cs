namespace NodePilot.Application.SystemStatus;

public sealed class SystemMetric
{
    public long Id { get; init; }
 
    public double? CpuUsagePercent { get; init; }
    
    public double? RamUsagePercent { get; init; }

    public MetricCollectionStatus Status { get; init; }

    public string? FailureReason { get; init; }
    
    public DateTime CollectedAtUtc { get; init; }
}

public enum MetricCollectionStatus
{
    Success,
    ReadFailed
}