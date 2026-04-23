using DotNetEnv;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace NodePilot.Infrastructure.Persistence;

public static class DatabaseExtensions
{
    public static void EnsureSqliteDirectoryExists(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);

        var dataSource = builder.DataSource;

        if (string.IsNullOrWhiteSpace(dataSource))
            throw new InvalidOperationException("SQLite Data Source is missing.");

        var fullPath = Path.GetFullPath(dataSource);
        var directory = Path.GetDirectoryName(fullPath);

        if (string.IsNullOrWhiteSpace(directory))
            return;

        Directory.CreateDirectory(directory);
    }
    public static async Task InitializeDatabaseAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();

        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("DatabaseInitialization");

        try
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<NodePilotDbContext>();

            logger.LogInformation("Applying database migrations...");
            await dbContext.Database.MigrateAsync();
            logger.LogInformation("Database is ready.");
        }
        catch (Exception ex)
        {
            logger.LogCritical(ex, "Database initialization failed. Application startup aborted.");
            throw;
        }
    }

    public static string ResolveConnectionString()
    {
        LoadDotEnv();

        var connectionString = Environment.GetEnvironmentVariable("NODE_PILOT_DB_CONNECTION_STRING")?.Trim();

        if (string.IsNullOrEmpty(connectionString))
            throw new InvalidOperationException("Environment variable 'NODE_PILOT_DB_CONNECTION_STRING' is missing.");

        return connectionString;
    }

    private static void LoadDotEnv()
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (directory is not null)
        {
            var envPath = Path.Combine(directory.FullName, ".env");

            if (File.Exists(envPath))
            {
                Env.Load(envPath);
                return;
            }

            directory = directory.Parent;
        }
    }
}
