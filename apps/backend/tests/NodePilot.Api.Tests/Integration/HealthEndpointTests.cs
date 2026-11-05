using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NodePilot.Api.Tests.Integration;

/// <summary>
/// Runs with collection disabled, so every check has a deterministic result
/// and nothing depends on the host's /proc or the first sampling cycle.
/// </summary>
[TestFixture]
[NonParallelizable]
public class HealthEndpointTests
{
    private NodePilotApiFactory _factory = null!;
    private HttpClient _client = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp()
    {
        _factory = new NodePilotApiFactory(new Dictionary<string, string?>
        {
            ["Monitoring:Collection:Enabled"] = "false",
        });
        _client = _factory.CreateClient();
    }

    [OneTimeTearDown]
    public void OneTimeTearDown()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [TestCase("/health")]
    [TestCase("/health/ready")]
    [TestCase("/health/live")]
    public async Task Endpoint_IsPublicAndHealthy(string url)
    {
        var response = await _client.GetAsync(url);
        var report = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(report.GetProperty("status").GetString(), Is.EqualTo("Healthy"));
    }

    [Test]
    public async Task Live_RunsNoChecks()
    {
        var report = await _client.GetFromJsonAsync<JsonElement>("/health/live");

        Assert.That(CheckNames(report), Is.Empty);
    }

    [Test]
    public async Task Ready_RunsOnlyReadyTaggedChecks()
    {
        var report = await _client.GetFromJsonAsync<JsonElement>("/health/ready");

        Assert.That(CheckNames(report), Is.EquivalentTo(new[] { "database_status", "metrics_collector" }));
    }

    [Test]
    public async Task Health_RunsAllChecks()
    {
        var report = await _client.GetFromJsonAsync<JsonElement>("/health");

        Assert.That(
            CheckNames(report),
            Is.EquivalentTo(new[] { "system_status", "database_status", "metrics_collector" }));
    }

    [Test]
    public async Task Health_CollectionDisabled_CollectorReportsHealthy()
    {
        var report = await _client.GetFromJsonAsync<JsonElement>("/health");

        var collector = report.GetProperty("checks").EnumerateArray()
            .Single(check => check.GetProperty("name").GetString() == "metrics_collector");

        Assert.That(collector.GetProperty("status").GetString(), Is.EqualTo("Healthy"));
        Assert.That(collector.GetProperty("description").GetString(), Is.EqualTo("Metrics collection is disabled."));
        Assert.That(collector.GetProperty("data").GetProperty("enabled").GetBoolean(), Is.False);
    }

    private static IEnumerable<string?> CheckNames(JsonElement report) =>
        report.GetProperty("checks").EnumerateArray().Select(check => check.GetProperty("name").GetString());
}
