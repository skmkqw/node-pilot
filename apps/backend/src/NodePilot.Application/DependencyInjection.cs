using Microsoft.Extensions.DependencyInjection;
using NodePilot.Application.SystemStatus.Services;

namespace NodePilot.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ISystemStatusService, SystemStatusService>();

        return services;
    }
}