using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Data.Sqlite;
using NodePilot.Infrastructure.Persistence;

namespace NodePilot.Api.HealthChecks;

public sealed class SqliteHealthCheck : IHealthCheck
{
    private readonly string _connectionString;

    public SqliteHealthCheck()
    {
        _connectionString = DatabaseExtensions.ResolveConnectionString();
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1;";
            var result = await command.ExecuteScalarAsync(cancellationToken);

            return result?.ToString() == "1"
                ? HealthCheckResult.Healthy(
                    description: "SQLite is reachable.",
                    data: new Dictionary<string, object>
                        {
                            { "state", connection.State.ToString() },
                            { "serverVersion", connection.ServerVersion },
                            { "timestampUtc", DateTime.UtcNow }
                        })
                : HealthCheckResult.Unhealthy("SQLite returned unexpected result.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("SQLite healthcheck failed.", ex);
        }
    }
}