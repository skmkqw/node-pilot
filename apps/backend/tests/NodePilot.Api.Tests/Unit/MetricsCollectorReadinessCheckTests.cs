using Microsoft.Extensions.Diagnostics.HealthChecks;
using NodePilot.Api.HealthChecks;
using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;
using NodePilot.Application.Monitoring.Settings;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class MetricsCollectorReadinessCheckTests
{
    private MetricsCollectorState _state = null!;

    [SetUp]
    public void SetUp() => _state = new MetricsCollectorState();

    [Test]
    public async Task CollectionDisabled_ReportsHealthy()
    {
        var result = await CheckAsync(enabled: false);

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Healthy));
        Assert.That(result.Description, Is.EqualTo("Metrics collection is disabled."));
        Assert.That(result.Data["enabled"], Is.False);
    }

    [Test]
    [Platform(Exclude = "Linux")]
    public async Task NonLinuxHost_ReportsDegraded()
    {
        _state.MarkRunning();

        var result = await CheckAsync();

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Degraded));
    }

    [Test]
    [Platform("Linux")]
    public async Task SamplerNeverStarted_ReportsUnhealthy()
    {
        var result = await CheckAsync();

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Unhealthy));
        Assert.That(result.Description, Is.EqualTo("Metrics collector is not running."));
        Assert.That(result.Data["enabled"], Is.True);
    }

    [Test]
    [Platform("Linux")]
    public async Task SamplerCrashed_ReportsUnhealthyWithLastError()
    {
        _state.MarkRunning();
        _state.MarkSuccess(DateTimeOffset.UtcNow);
        _state.MarkFailure(DateTimeOffset.UtcNow, "boom");
        _state.MarkStopped();

        var result = await CheckAsync();

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Unhealthy));
        Assert.That(result.Data["isRunning"], Is.False);
        Assert.That(result.Data["lastError"], Is.EqualTo("boom"));
    }

    [Test]
    [Platform("Linux")]
    public async Task RunningWithoutSuccess_ReportsUnhealthy()
    {
        _state.MarkRunning();
        _state.MarkFailure(DateTimeOffset.UtcNow, "read failed");

        var result = await CheckAsync();

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Unhealthy));
        Assert.That(result.Description, Is.EqualTo("Metrics collector has not produced any metrics yet."));
        Assert.That(result.Data["lastSuccessfulCollectionUtc"], Is.EqualTo("never"));
    }

    [Test]
    [Platform("Linux")]
    public async Task FreshSample_ReportsHealthy()
    {
        _state.MarkRunning();
        _state.MarkSuccess(DateTimeOffset.UtcNow.AddSeconds(-5));

        var result = await CheckAsync();

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Healthy));
        Assert.That(result.Data, Contains.Key("snapshotAgeSeconds"));
    }

    [Test]
    [Platform("Linux")]
    public async Task StaleSample_ReportsUnhealthy()
    {
        _state.MarkRunning();
        _state.MarkSuccess(DateTimeOffset.UtcNow.AddSeconds(-60));

        var result = await CheckAsync(intervalSeconds: 15);

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Unhealthy));
        Assert.That(result.Description, Is.EqualTo("Metrics collector data is stale."));
    }

    // Three missed cycles, but never less than 30 s.
    [TestCase(1, 30)]
    [TestCase(10, 30)]
    [TestCase(15, 45)]
    [TestCase(60, 180)]
    public async Task StalenessWindow_ScalesWithInterval(int intervalSeconds, double expectedSeconds)
    {
        var result = await CheckAsync(intervalSeconds: intervalSeconds);

        Assert.That(result.Data["maxSnapshotAgeSeconds"], Is.EqualTo(expectedSeconds));
    }

    [Test]
    [Platform("Linux")]
    public async Task LongInterval_SampleOlderThan30Seconds_IsStillHealthy()
    {
        _state.MarkRunning();
        _state.MarkSuccess(DateTimeOffset.UtcNow.AddSeconds(-100));

        var result = await CheckAsync(intervalSeconds: 60);

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Healthy));
    }

    private Task<HealthCheckResult> CheckAsync(bool enabled = true, int intervalSeconds = 15)
    {
        var settings = new MonitoringSettings
        {
            Collection = new CollectionSettings { Enabled = enabled, IntervalSeconds = intervalSeconds },
        };

        var check = new MetricsCollectorReadinessCheck(_state, new FixedSettings(settings));

        return check.CheckHealthAsync(new HealthCheckContext());
    }

    private sealed class FixedSettings(MonitoringSettings settings) : IMonitoringSettingsProvider
    {
        public MonitoringSettings Current { get; } = settings;
    }
}
