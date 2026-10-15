
using Microsoft.Extensions.Diagnostics.HealthChecks;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Api.HealthChecks;

public sealed class MetricsCollectorReadinessCheck : IHealthCheck
{
    private static readonly TimeSpan _minimumMaxSnapshotAge = TimeSpan.FromSeconds(30);

    private const int _toleratedMissedCycles = 3;

    private readonly MetricsCollectorState _state;

    private readonly IMonitoringSettingsProvider _monitoringSettingsProvider;

    public MetricsCollectorReadinessCheck(
        MetricsCollectorState state,
        IMonitoringSettingsProvider monitoringSettingsProvider)
    {
        _state = state;
        _monitoringSettingsProvider = monitoringSettingsProvider;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var snapshot = _state.Snapshot();
        var maxSnapshotAge = GetMaxSnapshotAge();

        var data = new Dictionary<string, object>
        {
            ["isRunning"] = snapshot.IsRunning,
            ["lastSuccessfulCollectionUtc"] = snapshot.LastSuccessfulCollectionUtc?.ToString("O") ?? "never",
            ["lastAttemptUtc"] = snapshot.LastAttemptUtc?.ToString("O") ?? "never",
            ["lastError"] = snapshot.LastError ?? "",
            ["maxSnapshotAgeSeconds"] = maxSnapshotAge.TotalSeconds
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

        if (age > maxSnapshotAge)
        {
            return Task.FromResult(
                HealthCheckResult.Unhealthy("Metrics collector data is stale.", data: data));
        }

        return Task.FromResult(
            HealthCheckResult.Healthy("Metrics collector is ready.", data: data));
    }

    // A fixed 30 s window would mark the collector stale for any interval above 30 s,
    // so allow a few missed cycles relative to the configured interval.
    private TimeSpan GetMaxSnapshotAge()
    {
        var interval = TimeSpan.FromSeconds(_monitoringSettingsProvider.Current.Collection.IntervalSeconds);
        var tolerated = interval * _toleratedMissedCycles;

        return tolerated > _minimumMaxSnapshotAge ? tolerated : _minimumMaxSnapshotAge;
    }
}
