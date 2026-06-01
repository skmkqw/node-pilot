using NodePilot.Application.Monitoring.Settings;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface IMonitoringSettingsProvider
{
	MonitoringSettings Current { get; }
}
