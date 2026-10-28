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

        string dataSource = builder.DataSource;

        if (string.IsNullOrWhiteSpace(dataSource))
            throw new InvalidOperationException("SQLite Data Source is missing.");

        string fullPath = Path.GetFullPath(dataSource);
        string? directory = Path.GetDirectoryName(fullPath);

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

    public const string DefaultConnectionString = "Data Source=data/nodepilot.db";

    /// <summary>
    /// Uses <c>NODE_PILOT_DB_CONNECTION_STRING</c> when set, otherwise a SQLite file in
    /// <c>data/</c> next to the working directory, so no configuration is required.
    /// </summary>
    public static string ResolveConnectionString()
    {
        LoadDotEnv();

        string? connectionString = Environment.GetEnvironmentVariable("NODE_PILOT_DB_CONNECTION_STRING")?.Trim();

        return string.IsNullOrEmpty(connectionString) ? DefaultConnectionString : connectionString;
    }

    /// <summary>Directory that holds the SQLite database; other persistent data lives next to it.</summary>
    public static string ResolveDataDirectory(string connectionString)
    {
        string dataSource = new SqliteConnectionStringBuilder(connectionString).DataSource;

        return Path.GetDirectoryName(Path.GetFullPath(dataSource)) ?? Directory.GetCurrentDirectory();
    }

    /// <summary>
    /// Loads the nearest <c>.env</c> file into the process environment without overriding
    /// variables that are already set (e.g. by Docker Compose or the test host).
    /// </summary>
    public static void LoadDotEnv()
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (directory is not null)
        {
            string envPath = Path.Combine(directory.FullName, ".env");

            if (File.Exists(envPath))
            {
                Env.NoClobber().Load(envPath);
                return;
            }

            directory = directory.Parent;
        }
    }
}
