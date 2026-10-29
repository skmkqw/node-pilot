using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Monitoring.Services;

public sealed class SystemOverviewProvider : ISystemOverviewProvider
{
    private const string _procUptimePath = "/proc/uptime";
    private const string _procLoadAvgPath = "/proc/loadavg";
    private const string _osReleasePath = "/etc/os-release";
    private const string _thermalZonesPath = "/sys/class/thermal";
    private const string _hwmonPath = "/sys/class/hwmon";
    private const string _diskMountPoint = "/";

    private readonly ISystemMetricsReader _metricsReader;
    private readonly IMonitoringSettingsProvider _monitoringSettingsProvider;
    private readonly ILogger<SystemOverviewProvider> _logger;

    public SystemOverviewProvider(
        ISystemMetricsReader metricsReader,
        IMonitoringSettingsProvider monitoringSettingsProvider,
        ILogger<SystemOverviewProvider> logger)
    {
        _metricsReader = metricsReader;
        _monitoringSettingsProvider = monitoringSettingsProvider;
        _logger = logger;
    }

    public SystemOverview GetOverview()
    {
        var settings = _monitoringSettingsProvider.Current.Collection;

        var memoryResult = _metricsReader.ReadMemoryInfo();

        return new SystemOverview(
            Hostname: Environment.MachineName,
            OperatingSystem: ReadOperatingSystemName(),
            Architecture: RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant(),
            ProcessorCount: Environment.ProcessorCount,
            UptimeSeconds: ReadOptional(_procUptimePath, LinuxSystemParsers.ParseUptimeSeconds),
            LoadAverage: ReadOptional(_procLoadAvgPath, LinuxSystemParsers.ParseLoadAverage),
            Memory: memoryResult.IsError ? null : memoryResult.Value,
            CpuTemperatureCelsius: settings.CollectTemperature ? ReadCpuTemperatureCelsius() : null,
            Disk: settings.CollectDiskUsage ? ReadDiskUsage(_diskMountPoint) : null,
            CollectedAtUtc: DateTime.UtcNow);
    }

    private static string ReadOperatingSystemName()
    {
        try
        {
            if (File.Exists(_osReleasePath))
            {
                string? prettyName = LinuxSystemParsers.ParseOsReleasePrettyName(File.ReadLines(_osReleasePath));

                if (prettyName is not null)
                {
                    return prettyName;
                }
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }

        return RuntimeInformation.OSDescription;
    }

    private T? ReadOptional<T>(string path, Func<string, T?> parse)
    {
        try
        {
            return File.Exists(path) ? parse(File.ReadAllText(path)) : default;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogDebug(ex, "Unable to read {Path}.", path);
            return default;
        }
    }

    public double? ReadCpuTemperatureCelsius()
    {
        var sensors = new List<TemperatureSensor>();

        // thermal_zoneN/{type,temp}
        sensors.AddRange(ReadSensors(_thermalZonesPath, "thermal_zone*", "type", "temp"));

        // hwmonN/{name,temp1_input}
        sensors.AddRange(ReadSensors(_hwmonPath, "hwmon*", "name", "temp1_input"));

        return LinuxSystemParsers.SelectCpuTemperatureCelsius(sensors);
    }

    private IEnumerable<TemperatureSensor> ReadSensors(
        string basePath,
        string directoryPattern,
        string nameFile,
        string valueFile)
    {
        if (!Directory.Exists(basePath))
        {
            yield break;
        }

        foreach (string directory in Directory.EnumerateDirectories(basePath, directoryPattern))
        {
            string? name = ReadOptional(Path.Combine(directory, nameFile), content => content.Trim());
            string? value = ReadOptional(Path.Combine(directory, valueFile), content => content.Trim());

            if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(value))
            {
                yield return new TemperatureSensor(name, value);
            }
        }
    }

    private DiskUsage? ReadDiskUsage(string mountPoint)
    {
        try
        {
            var drive = new DriveInfo(mountPoint);

            if (!drive.IsReady || drive.TotalSize <= 0)
            {
                return null;
            }

            long used = drive.TotalSize - drive.TotalFreeSpace;
            double percent = Math.Round(100.0 * used / drive.TotalSize, 2);

            return new DiskUsage(mountPoint, drive.TotalSize, used, drive.AvailableFreeSpace, percent);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            _logger.LogDebug(ex, "Unable to read disk usage for {MountPoint}.", mountPoint);
            return null;
        }
    }
}
