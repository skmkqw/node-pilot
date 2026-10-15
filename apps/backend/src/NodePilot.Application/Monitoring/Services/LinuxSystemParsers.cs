using System.Globalization;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Monitoring.Services;

/// <summary>
/// Pure parsing helpers for Linux pseudo-files. Kept free of I/O so they can be unit tested
/// with fixture strings.
/// </summary>
public static class LinuxSystemParsers
{
    // Sensor names ordered from most to least representative of the CPU package temperature.
    private static readonly string[] _cpuSensorPriority =
    [
        "x86_pkg_temp",
        "coretemp",
        "k10temp",
        "zenpower",
        "cpu_thermal",
        "cpu-thermal",
        "soc_thermal",
        "tcpu",
        "acpitz",
    ];

    private const double _minPlausibleCelsius = 1;
    private const double _maxPlausibleCelsius = 150;

    /// <summary>Parses the first field of <c>/proc/uptime</c> (seconds since boot).</summary>
    public static double? ParseUptimeSeconds(string content)
    {
        string? first = content
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault();

        return double.TryParse(first, NumberStyles.Float, CultureInfo.InvariantCulture, out double seconds)
            && seconds >= 0
                ? seconds
                : null;
    }

    /// <summary>Parses the 1, 5 and 15 minute averages from <c>/proc/loadavg</c>.</summary>
    public static LoadAverage? ParseLoadAverage(string content)
    {
        string[] parts = content.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length < 3)
        {
            return null;
        }

        var values = new double[3];

        for (int index = 0; index < 3; index++)
        {
            if (!double.TryParse(parts[index], NumberStyles.Float, CultureInfo.InvariantCulture, out values[index]))
            {
                return null;
            }
        }

        return new LoadAverage(values[0], values[1], values[2]);
    }

    /// <summary>Reads <c>PRETTY_NAME</c> from the lines of <c>/etc/os-release</c>.</summary>
    public static string? ParseOsReleasePrettyName(IEnumerable<string> lines)
    {
        const string key = "PRETTY_NAME=";

        string? line = lines.FirstOrDefault(x => x.StartsWith(key, StringComparison.Ordinal));

        string? value = line?[key.Length..].Trim().Trim('"');

        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>
    /// Picks the most representative CPU temperature from thermal zone / hwmon sensors.
    /// Raw values are in millidegrees Celsius, as exposed by the kernel.
    /// </summary>
    public static double? SelectCpuTemperatureCelsius(IEnumerable<TemperatureSensor> sensors)
    {
        var readings = sensors
            .Select(sensor => (sensor.Name, Celsius: ParseMillidegrees(sensor.RawValue)))
            .Where(reading => reading.Celsius is >= _minPlausibleCelsius and <= _maxPlausibleCelsius)
            .ToList();

        foreach (string preferred in _cpuSensorPriority)
        {
            var match = readings.FirstOrDefault(reading =>
                reading.Name.Equals(preferred, StringComparison.OrdinalIgnoreCase));

            if (match.Celsius is not null)
            {
                return Math.Round(match.Celsius.Value, 1);
            }
        }

        // Unknown board: fall back to the hottest plausible sensor.
        double? hottest = readings.Max(reading => reading.Celsius);

        return hottest is null ? null : Math.Round(hottest.Value, 1);
    }

    private static double? ParseMillidegrees(string raw)
    {
        return long.TryParse(raw.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out long millidegrees)
            ? millidegrees / 1000.0
            : null;
    }
}
