namespace NodePilot.Application.Monitoring.Models;

public sealed class IntervalMetricsSummary
{
    public int TotalSamples { get; init; }
    public int SuccessfulSamples { get; private set; }
    public int PartialSuccessSamples { get; private set; }
    public int FailedSamples { get; private set; }
    public double CollectionSuccessRatePercent =>
        TotalSamples == 0
            ? 0
            : Math.Round((double)SuccessfulSamples / TotalSamples * 100, 2);

    public int CpuMeasuredSamples { get; private set; }
    public double CpuCoveragePercent =>
        TotalSamples == 0
            ? 0
            : Math.Round((double)CpuMeasuredSamples / TotalSamples * 100, 2);

    public int RamMeasuredSamples { get; private set; }
    public double RamCoveragePercent =>
        TotalSamples == 0
            ? 0
            : Math.Round((double)RamMeasuredSamples / TotalSamples * 100, 2);

    public DateTimeOffset IntervalStart { get; init; }
    public DateTimeOffset IntervalEnd { get; init; }
    public int IntervalDurationSeconds => (int)(IntervalEnd - IntervalStart).TotalSeconds;

    public double? AverageCpuUsagePercent { get; init; }
    public double? MinCpuUsagePercent { get; private set; }
    public double? MaxCpuUsagePercent { get; private set; }

    public double? AverageRamUsagePercent { get; init; }
    public double? MinRamUsagePercent { get; private set; }
    public double? MaxRamUsagePercent { get; private set; }

    public IntervalMetricsSummary(MetricsBucket bucket)
    {
        if (bucket.Count == 0)
            throw new ArgumentException(
                "Interval must contain at least one sample.",
                nameof(bucket));

        TotalSamples = bucket.Count;

        var samples = bucket.Samples;

        IntervalStart = bucket.Start;
        IntervalEnd = bucket.End;

        double accumulatedCpuUsagePercent = 0;
        double accumulatedRamUsagePercent = 0;

        foreach (var sample in samples)
        {
            switch (sample.Status)
            {
                case MetricCollectionStatus.Success:
                    SuccessfulSamples++;
                    break;

                case MetricCollectionStatus.PartialSuccess:
                    PartialSuccessSamples++;
                    break;

                case MetricCollectionStatus.ReadFailed:
                    FailedSamples++;
                    break;
            }

            if (sample.CpuUsagePercent.HasValue)
            {
                CpuMeasuredSamples++;

                double cpuUsage = sample.CpuUsagePercent.Value;
                accumulatedCpuUsagePercent += cpuUsage;

                MinCpuUsagePercent = MinCpuUsagePercent is null
                    ? cpuUsage
                    : Math.Min(MinCpuUsagePercent.Value, cpuUsage);

                MaxCpuUsagePercent = MaxCpuUsagePercent is null
                    ? cpuUsage
                    : Math.Max(MaxCpuUsagePercent.Value, cpuUsage);
            }

            if (sample.RamUsagePercent.HasValue)
            {
                RamMeasuredSamples++;

                double ramUsage = sample.RamUsagePercent.Value;
                accumulatedRamUsagePercent += ramUsage;

                MinRamUsagePercent = MinRamUsagePercent is null
                    ? ramUsage
                    : Math.Min(MinRamUsagePercent.Value, ramUsage);

                MaxRamUsagePercent = MaxRamUsagePercent is null
                    ? ramUsage
                    : Math.Max(MaxRamUsagePercent.Value, ramUsage);
            }
        }

        AverageCpuUsagePercent =
            CpuMeasuredSamples > 0
                ? Math.Round(accumulatedCpuUsagePercent / CpuMeasuredSamples, 2) 
                : null;

        AverageRamUsagePercent =
            RamMeasuredSamples > 0
                ? Math.Round(accumulatedRamUsagePercent / RamMeasuredSamples, 2) 
                : null;
    }
}