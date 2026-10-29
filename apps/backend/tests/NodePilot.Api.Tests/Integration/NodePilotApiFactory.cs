using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace NodePilot.Api.Tests.Integration;

/// <summary>
/// Hosts the real API in memory with an isolated SQLite database and file manager root.
/// </summary>
public sealed class NodePilotApiFactory : WebApplicationFactory<Program>
{
    public const string Username = "admin";
    public const string Password = "integration-test-password";

    private readonly string _sandbox = Directory.CreateTempSubdirectory("nodepilot-api-").FullName;

    public NodePilotApiFactory()
    {
        // Read eagerly while the services are registered, so it has to be an environment variable.
        Environment.SetEnvironmentVariable(
            "NODE_PILOT_DB_CONNECTION_STRING",
            $"Data Source={Path.Combine(_sandbox, "nodepilot.db")}");
    }

    public string FilesRoot => Path.Combine(_sandbox, "files");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                // Integration tests sign in many times; production keeps the default of 5.
                ["Auth:LoginAttemptsPerMinute"] = "1000",
                ["FileManager:RootPath"] = FilesRoot,
                ["PiHole:BaseUrl"] = string.Empty,
                ["PiHole:Password"] = string.Empty,
            }));
    }

    /// <summary>Completes the first-start setup (once per factory) and signs a new client in.</summary>
    public async Task<HttpClient> CreateAuthenticatedClientAsync()
    {
        await EnsureAdministratorAsync();

        var client = CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { username = Username, password = Password });
        response.EnsureSuccessStatusCode();

        return client;
    }

    public async Task EnsureAdministratorAsync()
    {
        using var client = CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/setup", new { username = Username, password = Password });

        if (response.StatusCode != System.Net.HttpStatusCode.Conflict)
        {
            response.EnsureSuccessStatusCode();
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing && Directory.Exists(_sandbox))
        {
            Directory.Delete(_sandbox, recursive: true);
        }
    }
}
