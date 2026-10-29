using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NodePilot.Application.Accounts.Services;
using NodePilot.Application.Files.Services;
using NodePilot.Application.Interfaces.Accounts;
using NodePilot.Application.Interfaces.Files;
using NodePilot.Application.Interfaces.Monitoring;

using NodePilot.Application.Monitoring.Services;

namespace NodePilot.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton<ISystemMetricsReader, SystemMetricsReader>();
        services.AddSingleton<ISystemMetricsCollector, LinuxSystemMetricsCollector>();
        services.AddScoped<ISystemMetricsProvider, SystemMetricsProvider>();
        services.AddScoped<IMetricsRetentionService, MetricsRetentionService>();
        services.AddSingleton<ISystemOverviewProvider, SystemOverviewProvider>();
        services.AddSingleton<IFileManagerService, FileManagerService>();
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IInvitationService, InvitationService>();
        services.TryAddSingleton(TimeProvider.System);
        return services;
    }
}
