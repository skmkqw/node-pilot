public sealed class SystemMetric
{
    public long Id { get; set; }
 
    public double CpuUsagePercent { get; set; }
    
    public double RamUsagePercent { get; set; }
    
    public DateTimeOffset CollectedAtUtc { get; set; }
}