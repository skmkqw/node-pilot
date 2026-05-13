using Microsoft.Extensions.Configuration;

namespace NodePilot.Application.Monitoring.Settings;


public sealed class AlertingSettings
{
    [ConfigurationKeyName("CpuWarningThresholdPercent")]
    public double CpuWarningThresholdPercent { get; init; }

    [ConfigurationKeyName("RamWarningThresholdPercent")]
    public double RamWarningThresholdPercent { get; init; }

    [ConfigurationKeyName("DiskWarningThresholdPercent")]
    public double DiskWarningThresholdPercent { get; init; }

    [ConfigurationKeyName("CpuTemperatureWarningCelsius")]
    public double CpuTemperatureWarningCelsius { get; init; }

    [ConfigurationKeyName("NotificationsEnabled")]
    public bool NotificationsEnabled { get; init; }
}