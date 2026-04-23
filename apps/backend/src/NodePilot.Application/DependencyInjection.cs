using Microsoft.Extensions.DependencyInjection;
using NodePilot.Application.Interfaces.SystemStatus;

using NodePilot.Application.SystemStatus.Services;

namespace NodePilot.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton<ISystemMetricsReader, SystemMetricsReader>();
        services.AddSingleton<ISystemMetricsCollector, LinuxSystemMetricsCollector>();

        return services;
    }
}