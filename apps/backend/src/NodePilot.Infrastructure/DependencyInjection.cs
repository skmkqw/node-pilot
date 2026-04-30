using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Application.Interfaces.SystemStatus;
using NodePilot.Application.SystemStatus;
using NodePilot.Infrastructure.Background;
using NodePilot.Infrastructure.Persistence;
using NodePilot.Infrastructure.Persistence.Repositories;

namespace NodePilot.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = DatabaseExtensions.ResolveConnectionString();
        
        DatabaseExtensions.EnsureSqliteDirectoryExists(connectionString);

        services.AddDbContext<NodePilotDbContext>(options =>
        {
            options.UseSqlite(connectionString);
        });

        services.AddScoped<ISystemMetricsRepository, SystemMetricsRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Background Services
        services.AddHostedService<MetricsSamplingBackgroundService>();
        services.AddSingleton<MetricsCollectorState>();

        return services;
    }
}
