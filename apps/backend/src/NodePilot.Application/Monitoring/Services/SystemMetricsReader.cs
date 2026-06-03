using System.Globalization;
using ErrorOr;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;
using SystemStatusErrors = NodePilot.Application.Monitoring.Errors.Errors;

namespace NodePilot.Application.Monitoring.Services;


public sealed class SystemMetricsReader : ISystemMetricsReader
{
    private const string _procStatPath = "/proc/stat";
    private const string _procMemInfoPath = "/proc/meminfo";

    public async Task<ErrorOr<double>> ReadCpuUsagePercentAsync(CancellationToken cancellationToken)
    {
        var validePlatformResult = EnsureLinux();

        if (validePlatformResult.IsError)
            return validePlatformResult.Errors;

        var firstResult = ReadCpuTimes();

        if (firstResult.IsError)
            return firstResult.Errors;

        await Task.Delay(300, cancellationToken);
        var secondResult = ReadCpuTimes();

        if (secondResult.IsError)
            return secondResult.Errors;

        var first = firstResult.Value;
        var second = secondResult.Value;

        var idleDelta = second.Idle - first.Idle;
        var totalDelta = second.Total - first.Total;

        if (totalDelta <= 0)
        {
            return 0;
        }

        var usage = 100.0 * (1.0 - ((double)idleDelta / totalDelta));
        return Math.Clamp(usage, 0, 100);
    }

    public ErrorOr<MemoryInfo> ReadMemoryInfo()
    {
        var validePlatformResult = EnsureLinux();

        if (validePlatformResult.IsError)
            return validePlatformResult.Errors;

        string[] lines;

        try
        {
            lines = File.ReadAllLines(_procMemInfoPath);
        }
        catch (IOException)
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoUnavailable(_procMemInfoPath);
        }
        catch (UnauthorizedAccessException)
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoUnavailable(_procMemInfoPath);
        }

        var totalKbResult = ReadMemInfoValueKb(lines, "MemTotal");

        if (totalKbResult.IsError)
            return totalKbResult.Errors;

        var availableKbResult = ReadMemInfoValueKb(lines, "MemAvailable");

        if (availableKbResult.IsError)
            return availableKbResult.Errors;

        long totalKb = totalKbResult.Value;
        long availableKb = availableKbResult.Value;

        if (totalKb <= 0)
        {
            return SystemStatusErrors.SystemStatus.MemoryTotalInvalid(_procMemInfoPath);
        }

        long usedKb = totalKb - availableKb;

        long totalBytes = totalKb * 1024;
        long availableBytes = availableKb * 1024;
        long usedBytes = usedKb * 1024;

        double usagePercent = 100.0 * usedKb / totalKb;

        return new MemoryInfo(totalBytes, usedBytes, availableBytes, usagePercent);
    }

    private static ErrorOr<CpuTimes> ReadCpuTimes()
    {
        string? firstLine;

        try
        {
            firstLine = File.ReadLines(_procStatPath).FirstOrDefault();
        }
        catch (IOException)
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsUnavailable(_procStatPath);
        }
        catch (UnauthorizedAccessException)
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsUnavailable(_procStatPath);
        }

        if (string.IsNullOrWhiteSpace(firstLine) || !firstLine.StartsWith("cpu "))
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsUnavailable(_procStatPath);
        }

        var rawParts = firstLine
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Skip(1)
            .ToArray();

        var parts = new ulong[rawParts.Length];

        for (var index = 0 ; index < rawParts.Length ; index++)
        {
            var parsedValueResult = ParseUnsignedLong(rawParts[index]);

            if (parsedValueResult.IsError)
                return parsedValueResult.Errors;

            parts[index] = parsedValueResult.Value;
        }

        if (parts.Length < 4)
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsFormatInvalid(_procStatPath);
        }

        ulong user = parts.ElementAtOrDefault(0);
        ulong nice = parts.ElementAtOrDefault(1);
        ulong system = parts.ElementAtOrDefault(2);
        ulong idle = parts.ElementAtOrDefault(3);
        ulong iowait = parts.ElementAtOrDefault(4);
        ulong irq = parts.ElementAtOrDefault(5);
        ulong softirq = parts.ElementAtOrDefault(6);
        ulong steal = parts.ElementAtOrDefault(7);

        ulong idleAll = idle + iowait;
        ulong nonIdle = user + nice + system + irq + softirq + steal;
        ulong total = idleAll + nonIdle;

        return new CpuTimes(idleAll, total);
    }

    private static ErrorOr<long> ReadMemInfoValueKb(IEnumerable<string> lines, string key)
    {
        var line = lines.FirstOrDefault(x => x.StartsWith(key + ":", StringComparison.Ordinal));

        if (line is null)
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoKeyMissing(key, _procMemInfoPath);
        }

        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length < 2 || !long.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var valueKb))
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoValueInvalid(key, _procMemInfoPath);
        }

        return valueKb;
    }

    private static ErrorOr<ulong> ParseUnsignedLong(string value)
    {
        if (!ulong.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticValueInvalid(value, _procStatPath);
        }

        return parsed;
    }

    private static ErrorOr<Success> EnsureLinux()
    {
        if (!OperatingSystem.IsLinux())
        {
            return SystemStatusErrors.SystemStatus.PlatformNotSupported;
        }

        return Result.Success;
    }

    private readonly record struct CpuTimes(ulong Idle, ulong Total);
}
