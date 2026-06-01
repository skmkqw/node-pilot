using Microsoft.Extensions.Options;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Settings;

namespace NodePilot.Infrastructure.Configuration.Monitoring;

public sealed class MonitoringSettingsProvider
    : IMonitoringSettingsProvider
{
    private readonly IOptionsMonitor<MonitoringSettings> _monitor;

    public MonitoringSettingsProvider(
        IOptionsMonitor<MonitoringSettings> monitor)
    {
        _monitor = monitor;
    }

    public MonitoringSettings Current => _monitor.CurrentValue;
}