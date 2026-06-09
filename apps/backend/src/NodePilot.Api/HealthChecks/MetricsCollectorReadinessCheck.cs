
using Microsoft.Extensions.Diagnostics.HealthChecks;
using NodePilot.Application.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Api.HealthChecks;

public sealed class MetricsCollectorReadinessCheck : IHealthCheck
{
    private static readonly TimeSpan _maxSnapshotAge = TimeSpan.FromSeconds(30);

    private readonly MetricsCollectorState _state;

    public MetricsCollectorReadinessCheck(MetricsCollectorState state)
    {
        _state = state;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var snapshot = _state.Snapshot();

        var data = new Dictionary<string, object>
        {
            ["isRunning"] = snapshot.IsRunning,
            ["lastSuccessfulCollectionUtc"] = snapshot.LastSuccessfulCollectionUtc?.ToString("O") ?? "never",
            ["lastAttemptUtc"] = snapshot.LastAttemptUtc?.ToString("O") ?? "never",
            ["lastError"] = snapshot.LastError ?? "",
            ["maxSnapshotAgeSeconds"] = _maxSnapshotAge.TotalSeconds
        };

        if (!snapshot.IsRunning)
        {
            return Task.FromResult(
                HealthCheckResult.Unhealthy("Metrics collector is not running.", data: data));
        }

        if (snapshot.LastSuccessfulCollectionUtc is null)
        {
            return Task.FromResult(
                HealthCheckResult.Unhealthy("Metrics collector has not produced any metrics yet.", data: data));
        }

        var age = DateTimeOffset.UtcNow - snapshot.LastSuccessfulCollectionUtc.Value;
        data["snapshotAgeSeconds"] = Math.Round(age.TotalSeconds, 2);

        if (age > _maxSnapshotAge)
        {
            return Task.FromResult(
                HealthCheckResult.Unhealthy("Metrics collector data is stale.", data: data));
        }

        return Task.FromResult(
            HealthCheckResult.Healthy("Metrics collector is ready.", data: data));
    }
}
