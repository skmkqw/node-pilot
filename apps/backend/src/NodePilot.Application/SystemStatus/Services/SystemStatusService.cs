using System.Globalization;
using ErrorOr;
using SystemStatusErrors = NodePilot.Application.SystemStatus.Errors.Errors;

namespace NodePilot.Application.SystemStatus.Services;


public sealed class SystemStatusService : ISystemStatusService
{
    private const string ProcStatPath = "/proc/stat";
    private const string ProcMemInfoPath = "/proc/meminfo";

    public async Task<ErrorOr<SystemStatus>> GetSystemStatusAsync(CancellationToken cancellationToken = default)
    {
        var validePlatformResult = EnsureLinux();

        if (validePlatformResult.IsError)
            return validePlatformResult.Errors;

        var cpuUsageResult = await ReadCpuUsagePercentAsync(cancellationToken);

        if (cpuUsageResult.IsError)
            return cpuUsageResult.Errors;

        var memoryResult = ReadMemoryInfo();

        if (memoryResult.IsError)
            return memoryResult.Errors;

        var cpuUsage = cpuUsageResult.Value;
        var memory = memoryResult.Value;

        return new SystemStatus
        {
            CpuUsagePercent = Math.Round(cpuUsage, 2),
            RamUsagePercent = Math.Round(memory.RamUsagePercent, 2),
            TotalMemoryBytes = memory.TotalMemoryBytes,
            UsedMemoryBytes = memory.UsedMemoryBytes,
            AvailableMemoryBytes = memory.AvailableMemoryBytes,
            CollectedAtUtc = DateTimeOffset.UtcNow,
        };
    }

    private static ErrorOr<Success> EnsureLinux()
    {
        if (!OperatingSystem.IsLinux())
        {
            return SystemStatusErrors.SystemStatus.PlatformNotSupported;
        }

        return Result.Success;
    }

    private static async Task<ErrorOr<double>> ReadCpuUsagePercentAsync(CancellationToken cancellationToken)
    {
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

    private static ErrorOr<CpuTimes> ReadCpuTimes()
    {
        string? firstLine;

        try
        {
            firstLine = File.ReadLines(ProcStatPath).FirstOrDefault();
        }
        catch (IOException)
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsUnavailable(ProcStatPath);
        }
        catch (UnauthorizedAccessException)
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsUnavailable(ProcStatPath);
        }

        if (string.IsNullOrWhiteSpace(firstLine) || !firstLine.StartsWith("cpu "))
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsUnavailable(ProcStatPath);
        }

        var rawParts = firstLine
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Skip(1)
            .ToArray();

        var parts = new ulong[rawParts.Length];

        for (var index = 0; index < rawParts.Length; index++)
        {
            var parsedValueResult = ParseUnsignedLong(rawParts[index]);

            if (parsedValueResult.IsError)
                return parsedValueResult.Errors;

            parts[index] = parsedValueResult.Value;
        }

        if (parts.Length < 4)
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticsFormatInvalid(ProcStatPath);
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

    private static ErrorOr<MemoryInfo> ReadMemoryInfo()
    {
        string[] lines;

        try
        {
            lines = File.ReadAllLines(ProcMemInfoPath);
        }
        catch (IOException)
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoUnavailable(ProcMemInfoPath);
        }
        catch (UnauthorizedAccessException)
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoUnavailable(ProcMemInfoPath);
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
            return SystemStatusErrors.SystemStatus.MemoryTotalInvalid(ProcMemInfoPath);
        }

        long usedKb = totalKb - availableKb;

        long totalBytes = totalKb * 1024;
        long availableBytes = availableKb * 1024;
        long usedBytes = usedKb * 1024;

        double usagePercent = 100.0 * usedKb / totalKb;

        return new MemoryInfo(totalBytes, usedBytes, availableBytes, usagePercent);
    }

    private static ErrorOr<long> ReadMemInfoValueKb(IEnumerable<string> lines, string key)
    {
        var line = lines.FirstOrDefault(x => x.StartsWith(key + ":", StringComparison.Ordinal));

        if (line is null)
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoKeyMissing(key, ProcMemInfoPath);
        }

        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length < 2 || !long.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var valueKb))
        {
            return SystemStatusErrors.SystemStatus.MemoryInfoValueInvalid(key, ProcMemInfoPath);
        }

        return valueKb;
    }

    private static ErrorOr<ulong> ParseUnsignedLong(string value)
    {
        if (!ulong.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return SystemStatusErrors.SystemStatus.CpuStatisticValueInvalid(value, ProcMemInfoPath);
        }

        return parsed;
    }

    private readonly record struct CpuTimes(ulong Idle, ulong Total);

    private readonly record struct MemoryInfo(
        long TotalMemoryBytes,
        long UsedMemoryBytes,
        long AvailableMemoryBytes,
        double RamUsagePercent);
}
