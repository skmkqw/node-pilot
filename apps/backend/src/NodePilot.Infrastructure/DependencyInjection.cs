using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NodePilot.Infrastructure.Persistence;

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

        return services;
    }
}
