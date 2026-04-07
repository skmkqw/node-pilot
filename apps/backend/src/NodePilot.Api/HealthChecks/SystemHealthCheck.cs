using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace NodePilot.Api.HealthChecks;

public class SystemHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var metadata = new Dictionary<string, object>()
            {
                { "dotnetVersion", Environment.Version.ToString() },
                { "processors", Environment.ProcessorCount },
                { "osVersion", Environment.OSVersion.VersionString },
                { "os", Environment.OSVersion.Platform.ToString() }
            };

            return Task.FromResult(HealthCheckResult.Healthy("Server ready", data: metadata));
        }
        catch (Exception ex)
        {
            var failure = HealthCheckResult.Unhealthy("Check failure", exception: ex);
            return Task.FromResult(failure);
        }
    }
}