using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using NodePilot.Api;
using NodePilot.Api.HealthChecks;
using NodePilot.Application;
using NodePilot.Infrastructure;
using NodePilot.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddPresentation()
    .AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.UseCors("WebClient");

app.MapControllers();

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = HealthCheckResponseWriter.WriteAsync,
});

await app.Services.InitializeDatabaseAsync();

app.Run();
