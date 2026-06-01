using FluentValidation;
using NodePilot.Application.Monitoring.Settings;

namespace NodePilot.Infrastructure.Configuration.Monitoring;

public sealed class MonitoringSettingsValidator
    : AbstractValidator<MonitoringSettings>
{
    public MonitoringSettingsValidator()
    {
        RuleFor(x => x.Collection)
            .NotNull()
            .WithMessage("Monitoring:Collection section is required.");

        RuleFor(x => x.Retention)
            .NotNull()
            .WithMessage("Monitoring:Retention section is required.");

        RuleFor(x => x.Alerts)
            .NotNull()
            .WithMessage("Monitoring:Alerts section is required.");

        When(x => x.Collection is not null, ValidateCollection);

        When(x => x.Retention is not null, ValidateRetention);

        When(x => x.Alerts is not null, ValidateAlerts);
    }

    private void ValidateCollection()
    {
        RuleFor(x => x.Collection.Enabled)
            .NotNull()
            .WithMessage(
                "Monitoring:Collection:Enabled must be configured explicitly.");

        RuleFor(x => x.Collection.IntervalSeconds)
            .NotNull()
            .WithMessage(
                "Monitoring:Collection:IntervalSeconds is required.")
            .InclusiveBetween(1, 3600)
            .WithMessage(
                "Collection interval must be between 1 and 3600 seconds.");

        RuleFor(x => x.Collection.CollectCpuUsage)
            .NotNull()
            .WithMessage(
                "Monitoring:Collection:CollectCpuUsage is required.");

        RuleFor(x => x.Collection.CollectRamUsage)
            .NotNull()
            .WithMessage(
                "Monitoring:Collection:CollectRamUsage is required.");

        RuleFor(x => x.Collection.CollectDiskUsage)
            .NotNull()
            .WithMessage(
                "Monitoring:Collection:CollectDiskUsage is required.");

        RuleFor(x => x.Collection.CollectTemperature)
            .NotNull()
            .WithMessage(
                "Monitoring:Collection:CollectTemperature is required.");

        RuleFor(x => x.Collection)
            .Must(HaveAtLeastOneMetricEnabled)
            .When(x => x.Collection.Enabled == true)
            .WithMessage(
                "At least one metric collector must be enabled when monitoring collection is enabled.");
    }

    private void ValidateRetention()
    {
        RuleFor(x => x.Retention.CleanupEnabled)
            .NotNull()
            .WithMessage(
                "Monitoring:Retention:CleanupEnabled is required.");

        RuleFor(x => x.Retention.MaxMetricAgeHours)
            .NotNull()
            .WithMessage(
                "Monitoring:Retention:MaxMetricAgeHours is required.")
            .InclusiveBetween(1, 24 * 365)
            .WithMessage(
                "Max metric age must be between 1 hour and 1 year.");

        RuleFor(x => x.Retention.CleanupIntervalMinutes)
            .NotNull()
            .WithMessage(
                "Monitoring:Retention:CleanupIntervalMinutes is required.")
            .InclusiveBetween(1, 1440)
            .WithMessage(
                "Cleanup interval must be between 1 and 1440 minutes.");

        RuleFor(x => x.Retention.MaxStoredSamples)
            .NotNull()
            .WithMessage(
                "Monitoring:Retention:MaxStoredSamples is required.")
            .InclusiveBetween(100, 10_000_000)
            .WithMessage(
                "Max stored samples must be between 100 and 10,000,000.");
    }

    private void ValidateAlerts()
    {
        RuleFor(x => x.Alerts.NotificationsEnabled)
            .NotNull()
            .WithMessage(
                "Monitoring:Alerts:NotificationsEnabled is required.");

        RuleFor(x => x.Alerts.CpuWarningThresholdPercent)
            .NotNull()
            .WithMessage(
                "Monitoring:Alerts:CpuWarningThresholdPercent is required.")
            .InclusiveBetween(1, 100)
            .WithMessage(
                "CPU warning threshold must be between 1 and 100 percent.");

        RuleFor(x => x.Alerts.RamWarningThresholdPercent)
            .NotNull()
            .WithMessage(
                "Monitoring:Alerts:RamWarningThresholdPercent is required.")
            .InclusiveBetween(1, 100)
            .WithMessage(
                "RAM warning threshold must be between 1 and 100 percent.");

        RuleFor(x => x.Alerts.DiskWarningThresholdPercent)
            .NotNull()
            .WithMessage(
                "Monitoring:Alerts:DiskWarningThresholdPercent is required.")
            .InclusiveBetween(1, 100)
            .WithMessage(
                "Disk warning threshold must be between 1 and 100 percent.");

        RuleFor(x => x.Alerts.CpuTemperatureWarningCelsius)
            .NotNull()
            .WithMessage(
                "Monitoring:Alerts:CpuTemperatureWarningCelsius is required.")
            .InclusiveBetween(30, 120)
            .WithMessage(
                "CPU temperature warning threshold must be between 30 and 120 Celsius.");
    }

    private static bool HaveAtLeastOneMetricEnabled(
        CollectionSettings settings)
    {
        return settings.CollectCpuUsage == true
            || settings.CollectRamUsage == true
            || settings.CollectDiskUsage == true
            || settings.CollectTemperature == true;
    }
}