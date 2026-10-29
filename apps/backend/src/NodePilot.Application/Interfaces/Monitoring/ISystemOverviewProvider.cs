using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemOverviewProvider
{
    SystemOverview GetOverview();

    /// <summary>CPU package temperature, or <c>null</c> when no sensor is available (e.g. in a VM).</summary>
    double? ReadCpuTemperatureCelsius();
}
