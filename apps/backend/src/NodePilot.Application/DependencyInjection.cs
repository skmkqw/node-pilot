using Microsoft.Extensions.DependencyInjection;
using NodePilot.Application.Interfaces.Monitoring;

using NodePilot.Application.Monitoring.Services;

namespace NodePilot.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton<ISystemMetricsReader, SystemMetricsReader>();
        services.AddSingleton<ISystemMetricsCollector, LinuxSystemMetricsCollector>();
        services.AddScoped<ISystemMetricsProvider, SystemMetricsProvider>();

        return services;
    }
}