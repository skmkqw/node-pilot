using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using ErrorOr;
using NodePilot.Application.AdBlocking.Models;
using NodePilot.Application.AdBlocking.Settings;
using NodePilot.Application.Common;
using NodePilot.Application.Interfaces.AdBlocking;
using NodePilot.Infrastructure.AdBlocking;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class PiHoleClientTests
{
    private const string _password = "app-password";

    [Test]
    public async Task GetStatus_NotConfigured_DoesNotCallPiHole()
    {
        var handler = new FakePiHole();
        var client = CreateClient(handler, baseUrl: "");

        var status = await client.GetStatusAsync();

        Assert.That(status.Configured, Is.False);
        Assert.That(handler.Requests, Is.Empty);
    }

    [Test]
    public async Task GetStatus_AuthenticatesOnceAndMapsSummary()
    {
        var handler = new FakePiHole();
        var client = CreateClient(handler);

        var first = await client.GetStatusAsync();
        await client.GetStatusAsync();

        Assert.That(first.Reachable, Is.True);
        Assert.That(first.BlockingEnabled, Is.True);
        Assert.That(first.TotalQueries, Is.EqualTo(41234));
        Assert.That(first.PercentBlocked, Is.EqualTo(30.08));
        Assert.That(first.ActiveClients, Is.EqualTo(18));
        Assert.That(handler.Requests.Count(request => request == "POST /api/auth"), Is.EqualTo(1), "session should be reused");
    }

    [Test]
    public async Task GetStatus_ExpiredSession_ReauthenticatesAndRetries()
    {
        var handler = new FakePiHole();
        var client = CreateClient(handler);

        await client.GetStatusAsync();
        handler.ExpireSession();
        var status = await client.GetStatusAsync();

        Assert.That(status.Reachable, Is.True);
        Assert.That(handler.Requests.Count(request => request == "POST /api/auth"), Is.EqualTo(2));
    }

    [Test]
    public async Task GetStatus_WrongPassword_ReportsUnreachableWithReason()
    {
        var client = CreateClient(new FakePiHole(), password: "wrong");

        var status = await client.GetStatusAsync();

        Assert.That(status.Configured, Is.True);
        Assert.That(status.Reachable, Is.False);
        Assert.That(status.Message, Does.Contain("password"));
    }

    [Test]
    public async Task SetBlocking_SendsTimerAndReturnsNewState()
    {
        var handler = new FakePiHole();
        var client = CreateClient(handler);

        var result = await client.SetBlockingAsync(enabled: false, durationSeconds: 300);

        Assert.That(result.IsError, Is.False);
        Assert.That(result.Value.BlockingEnabled, Is.False);
        Assert.That(result.Value.BlockingTimerSeconds, Is.EqualTo(300));
    }

    [Test]
    public async Task SetBlocking_PiHoleDown_ReturnsUpstreamError()
    {
        var client = CreateClient(new FakePiHole { IsDown = true });

        var result = await client.SetBlockingAsync(enabled: true, durationSeconds: null);

        Assert.That(result.IsError, Is.True);
        Assert.That(result.FirstError.NumericType, Is.EqualTo(CustomErrorTypes.Upstream));
    }

    [TestCase(0)]
    [TestCase(90_000)]
    public async Task SetBlocking_InvalidDuration_ReturnsValidationError(int duration)
    {
        var result = await CreateClient(new FakePiHole()).SetBlockingAsync(false, duration);

        Assert.That(result.FirstError.Code, Is.EqualTo("AdBlocker.InvalidDuration"));
    }

    [Test]
    public async Task TestConnection_UsesThrowawaySessionAndLogsOut()
    {
        var handler = new FakePiHole();
        var client = CreateClient(handler);

        await client.GetStatusAsync();
        var tested = await client.TestConnectionAsync(Settings());
        await client.GetStatusAsync();

        Assert.That(tested.Reachable, Is.True);
        Assert.That(handler.LoggedOut, Is.EqualTo(1), "the test session is closed");
        Assert.That(handler.Requests.Count(request => request == "POST /api/auth"), Is.EqualTo(2), "cached session kept for status");
    }

    [Test]
    public async Task TestConnection_WrongPassword_ReportsReason()
    {
        var status = await CreateClient(new FakePiHole()).TestConnectionAsync(Settings(password: "nope"));

        Assert.That(status.Reachable, Is.False);
        Assert.That(status.Message, Does.Contain("password"));
    }

    [Test]
    public async Task ChangedPassword_StartsNewSession()
    {
        var handler = new FakePiHole();
        var store = new StaticSettingsStore(Settings(password: "outdated-password"));
        var client = CreateClient(handler, store);

        var before = await client.GetStatusAsync();
        store.Current = Settings();
        var after = await client.GetStatusAsync();

        Assert.That(before.Reachable, Is.False);
        Assert.That(after.Reachable, Is.True, "new credentials are used immediately");
    }

    private static PiHoleClient CreateClient(FakePiHole handler, string baseUrl = "http://pihole.test", string password = _password) =>
        CreateClient(handler, new StaticSettingsStore(Settings(baseUrl, password)));

    private static PiHoleClient CreateClient(FakePiHole handler, StaticSettingsStore store) =>
        new(new HttpClient(handler), store, new PiHoleSessionStore(), NullLogger<PiHoleClient>.Instance);

    private static PiHoleSettings Settings(string baseUrl = "http://pihole.test", string password = _password) =>
        new() { BaseUrl = baseUrl, Password = password, RequestTimeoutSeconds = 5 };

    private sealed class StaticSettingsStore(PiHoleSettings settings) : IPiHoleSettingsStore
    {
        public PiHoleSettings Current { get; set; } = settings;

        public Task<PiHoleSettings> GetEffectiveAsync(CancellationToken ct = default) => Task.FromResult(Current);

        public Task<PiHoleConnectionInfo> GetInfoAsync(CancellationToken ct = default) =>
            Task.FromResult(new PiHoleConnectionInfo(Current.BaseUrl, Current.Password.Length > 0, PiHoleSettingsSource.App));

        public Task<ErrorOr<PiHoleConnectionInfo>> SaveAsync(string? baseUrl, string? password, CancellationToken ct = default) =>
            throw new NotSupportedException();

        public Task ClearAsync(CancellationToken ct = default) => throw new NotSupportedException();
    }

    /// <summary>In-memory stand-in for the Pi-hole v6 REST API.</summary>
    private sealed class FakePiHole : HttpMessageHandler
    {
        // Pi-hole keeps several sessions at once; each login adds one, logout removes it.
        private readonly HashSet<string> _validSids = [];
        private int _sessionCounter;
        private string _blocking = "enabled";
        private int? _timer;

        public bool IsDown { get; init; }

        public List<string> Requests { get; } = [];

        public int LoggedOut { get; private set; }

        public void ExpireSession() => _validSids.Clear();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (IsDown)
            {
                throw new HttpRequestException("Connection refused");
            }

            string path = request.RequestUri!.AbsolutePath;
            Requests.Add($"{request.Method} {path}");

            string body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);

            if (path == "/api/auth" && request.Method == HttpMethod.Delete)
            {
                _validSids.Remove(request.Headers.GetValues("X-FTL-SID").Single());
                LoggedOut++;
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }

            if (path == "/api/auth")
            {
                bool valid = JsonDocument.Parse(body).RootElement.GetProperty("password").GetString() == _password;
                string? newSid = valid ? $"sid-{++_sessionCounter}" : null;

                if (newSid is not null)
                {
                    _validSids.Add(newSid);
                }

                return Json(valid ? HttpStatusCode.OK : HttpStatusCode.Unauthorized, new
                {
                    session = new { valid, sid = newSid, message = valid ? "success" : "password incorrect" },
                });
            }

            if (!request.Headers.TryGetValues("X-FTL-SID", out var sid) || !_validSids.Contains(sid.Single()))
            {
                return Json(HttpStatusCode.Unauthorized, new { error = new { key = "unauthorized" } });
            }

            if (path == "/api/dns/blocking" && request.Method == HttpMethod.Post)
            {
                var root = JsonDocument.Parse(body).RootElement;
                _blocking = root.GetProperty("blocking").GetBoolean() ? "enabled" : "disabled";
                _timer = root.GetProperty("timer").ValueKind == JsonValueKind.Number ? root.GetProperty("timer").GetInt32() : null;
            }

            return path switch
            {
                "/api/dns/blocking" => Json(HttpStatusCode.OK, new { blocking = _blocking, timer = _timer }),
                "/api/stats/summary" => Json(HttpStatusCode.OK, new
                {
                    queries = new { total = 41234, blocked = 12403, percent_blocked = 30.0791 },
                    clients = new { active = 18, total = 25 },
                    gravity = new { domains_being_blocked = 174832 },
                }),
                _ => new HttpResponseMessage(HttpStatusCode.NotFound),
            };
        }

        private static HttpResponseMessage Json(HttpStatusCode status, object payload) => new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
    }
}
