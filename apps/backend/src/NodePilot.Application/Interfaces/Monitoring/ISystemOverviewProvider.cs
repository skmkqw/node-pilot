using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Interfaces.Monitoring;

public interface ISystemOverviewProvider
{
    SystemOverview GetOverview();
}
