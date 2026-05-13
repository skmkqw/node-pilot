namespace NodePilot.Application.Monitoring.Settings;


public sealed class AlertingSettings
{
    public double CpuWarningThresholdPercent { get; init; } = 85;

    public double RamWarningThresholdPercent { get; init; } = 90;

    public double DiskWarningThresholdPercent { get; init; } = 90;

    public double CpuTemperatureWarningCelsius { get; init; } = 80;

    public bool NotificationsEnabled { get; init; } = true;
}