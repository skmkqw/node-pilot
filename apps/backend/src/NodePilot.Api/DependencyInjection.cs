using System.Text.Json.Serialization;
using NodePilot.Api.Auth;
using NodePilot.Api.Cors;
using NodePilot.Api.HealthChecks;

namespace NodePilot.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddPresentation(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddControllers().AddJsonOptions(opts =>
        {
            opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        services.AddCookieAuthentication(configuration);
        services.AddLoginRateLimiting();

        var corsSettings = configuration
            .GetSection(CorsSettings.SectionName)
            .Get<CorsSettings>() ?? new CorsSettings();

        services.AddCors(options =>
        {
            options.AddPolicy("WebClient", policy =>
            {
                policy
                    .SetIsOriginAllowed(origin => OriginPolicy.IsAllowed(origin, corsSettings))
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
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
