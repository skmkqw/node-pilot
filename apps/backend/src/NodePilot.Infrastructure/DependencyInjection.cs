using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using NodePilot.Application.AdBlocking.Settings;
using NodePilot.Application.Files.Settings;
using NodePilot.Application.Interfaces.AdBlocking;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;
using NodePilot.Application.Monitoring.Settings;
using NodePilot.Infrastructure.AdBlocking;
using NodePilot.Infrastructure.Background;
using NodePilot.Infrastructure.Configuration;
using NodePilot.Infrastructure.Configuration.Monitoring;
using NodePilot.Infrastructure.Persistence;
using NodePilot.Infrastructure.Persistence.Repositories;

namespace NodePilot.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        string connectionString = DatabaseExtensions.ResolveConnectionString();

        DatabaseExtensions.EnsureSqliteDirectoryExists(connectionString);

        services.AddDbContext<NodePilotDbContext>(options => options.UseSqlite(connectionString));

        services.AddScoped<ISystemMetricsRepository, SystemMetricsRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Background Services
        services.AddHostedService<MetricsSamplingBackgroundService>();
        services.AddSingleton<MetricsCollectorState>();

        services.AddHostedService<MetricsCleanupBackgroundService>();

        // Configuration
        services.AddSingleton<IValidator<MonitoringSettings>, MonitoringSettingsValidator>();
        services
            .AddOptions<MonitoringSettings>()
            .Bind(configuration.GetSection("Monitoring"), options => options.ErrorOnUnknownConfiguration = true)
            .ValidateFluently()
            .ValidateOnStart();
        services.AddSingleton<IMonitoringSettingsProvider, MonitoringSettingsProvider>();

        services
            .AddOptions<FileManagerSettings>()
            .Bind(configuration.GetSection(FileManagerSettings.SectionName))
            .Validate(
                settings => !string.IsNullOrWhiteSpace(settings.RootPath),
                "FileManager:RootPath must be configured.")
            .Validate(
                settings => settings.MaxUploadMegabytes is >= 1 and <= 100 * 1024,
                "FileManager:MaxUploadMegabytes must be between 1 and 102400.")
            .ValidateOnStart();

        // Ad blocking (Pi-hole)
        services
            .AddOptions<PiHoleSettings>()
            .Bind(configuration.GetSection(PiHoleSettings.SectionName))
            .Validate(
                settings => !settings.IsConfigured || Uri.TryCreate(settings.BaseUrl, UriKind.Absolute, out _),
                "PiHole:BaseUrl must be an absolute URL, e.g. http://192.168.1.2.")
            .Validate(
                settings => settings.RequestTimeoutSeconds is >= 1 and <= 60,
                "PiHole:RequestTimeoutSeconds must be between 1 and 60.")
            .ValidateOnStart();

        services.AddSingleton<PiHoleSessionStore>();
        services.AddHttpClient<IAdBlockerService, PiHoleClient>((serviceProvider, client) =>
        {
            var settings = serviceProvider.GetRequiredService<IOptions<PiHoleSettings>>().Value;
            client.Timeout = TimeSpan.FromSeconds(settings.RequestTimeoutSeconds);
        });

        return services;
    }
}
