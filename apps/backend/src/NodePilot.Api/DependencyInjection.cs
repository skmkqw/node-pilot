using NodePilot.Api.HealthChecks;

namespace NodePilot.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddPresentation(this IServiceCollection services)
    {
        services.AddControllers();

        services.AddCors(options =>
        {
            options.AddPolicy("WebClient", policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:3000",
                        "http://192.168.1.20:3000"
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        services.AddHealthChecks()
            .AddCheck<SystemHealthCheck>(
                "system_status",
                tags: ["general"])
            .AddCheck<SqliteHealthCheck>(
                "database_status",
                tags: ["database", "ready"])
            .AddCheck<MetricsCollectorReadinessCheck>(
                "metrics_collector",
                tags: ["collector", "ready"]);

        return services;
    }
}
