using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using NodePilot.Api;
using NodePilot.Api.HealthChecks;
using NodePilot.Application;
using NodePilot.Infrastructure;
using NodePilot.Infrastructure.Persistence;

// Load .env before the builder snapshots environment variables into configuration,
// so settings such as Auth__Password can be provided through the .env file.
DatabaseExtensions.LoadDotEnv();

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddPresentation(builder.Configuration)
    .AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.UseCors("WebClient");

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

app.MapControllers();

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = HealthCheckResponseWriter.WriteAsync,
}).AllowAnonymous();

await app.Services.InitializeDatabaseAsync();

app.Run();

public partial class Program;
