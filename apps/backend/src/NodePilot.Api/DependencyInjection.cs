using NodePilot.Api.HealthChecks;

namespace NodePilot.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddPresentation(this IServiceCollection services)
    {
        services.AddControllers();

        services.AddHealthChecks()
            .AddCheck<SystemHealthCheck>(
                "system_status",
                tags: ["general"]);

        return services;
    }
}
