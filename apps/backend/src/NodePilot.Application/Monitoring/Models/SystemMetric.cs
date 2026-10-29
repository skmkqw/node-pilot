namespace NodePilot.Application.Monitoring.Models;

public sealed class SystemMetric
{
    public long Id { get; init; }

    public bool CpuEnabled { get; init; }

    public double? CpuUsagePercent { get; set; }

    public bool RamEnabled { get; init; }

    public double? RamUsagePercent { get; set; }

    /// <summary>
    /// Optional: not counted in <see cref="TotalReads"/>, because many machines (VMs, containers)
    /// have no temperature sensor and that should not mark every sample as a partial failure.
    /// </summary>
    public double? CpuTemperatureCelsius { get; set; }

    public MetricCollectionStatus Status { get; init; }

    public int TotalReads { get; init; }

    public int SuccessfulReads { get; init; }

    public string? FailureReason { get; init; }

    public DateTime CollectedAtUtc { get; init; }
}

public enum MetricCollectionStatus
{
    Success,
    PartialSuccess,
    ReadFailed
}
