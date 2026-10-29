using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ErrorOr;
using Microsoft.Extensions.Logging;
using NodePilot.Application.AdBlocking.Errors;
using NodePilot.Application.AdBlocking.Models;
using NodePilot.Application.AdBlocking.Settings;
using NodePilot.Application.Interfaces.AdBlocking;

namespace NodePilot.Infrastructure.AdBlocking;

/// <summary>
/// <see cref="IAdBlockerService"/> backed by the Pi-hole v6 REST API.
/// </summary>
public sealed class PiHoleClient : IAdBlockerService
{
    private const string _sessionHeader = "X-FTL-SID";
    private const int _maxDurationSeconds = 24 * 60 * 60;

    private readonly HttpClient _httpClient;
    private readonly IPiHoleSettingsStore _settingsStore;
    private readonly PiHoleSessionStore _sessionStore;
    private readonly ILogger<PiHoleClient> _logger;

    public PiHoleClient(
        HttpClient httpClient,
        IPiHoleSettingsStore settingsStore,
        PiHoleSessionStore sessionStore,
        ILogger<PiHoleClient> logger)
    {
        _httpClient = httpClient;
        _settingsStore = settingsStore;
        _sessionStore = sessionStore;
        _logger = logger;
    }

    public async Task<AdBlockerStatus> GetStatusAsync(CancellationToken ct = default)
    {
        var settings = await _settingsStore.GetEffectiveAsync(ct);

        if (!settings.IsConfigured)
        {
            return AdBlockerStatus.NotConfigured();
        }

        return await ReadStatusAsync(settings, CachedSession(settings), ct);
    }

    public async Task<ErrorOr<AdBlockerStatus>> SetBlockingAsync(
        bool enabled,
        int? durationSeconds,
        CancellationToken ct = default)
    {
        var settings = await _settingsStore.GetEffectiveAsync(ct);

        if (!settings.IsConfigured)
        {
            return AdBlockerErrors.NotConfigured;
        }

        if (durationSeconds is < 1 or > _maxDurationSeconds)
        {
            return AdBlockerErrors.InvalidDuration;
        }

        try
        {
            await SendAsync<PiHoleBlockingResponse>(
                settings,
                CachedSession(settings),
                HttpMethod.Post,
                "api/dns/blocking",
                new PiHoleBlockingRequest(enabled, durationSeconds),
                ct);

            _logger.LogInformation(
                "Pi-hole blocking set to {Enabled} for {Duration}.",
                enabled,
                durationSeconds is null ? "unlimited time" : $"{durationSeconds} s");
        }
        catch (Exception ex) when (IsUpstreamFailure(ex) && !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Changing Pi-hole blocking failed.");

            return AdBlockerErrors.Unreachable(DescribeFailure(ex));
        }

        return await ReadStatusAsync(settings, CachedSession(settings), ct);
    }

    public async Task<AdBlockerStatus> TestConnectionAsync(PiHoleSettings candidate, CancellationToken ct = default)
    {
        if (!candidate.IsConfigured)
        {
            return AdBlockerStatus.NotConfigured();
        }

        // A separate, short-lived session: testing must not replace the cached one, and it is
        // logged out afterwards so it does not count against Pi-hole's session limit.
        var session = new OneOffSession(ct => AuthenticateAsync(candidate, ct));

        try
        {
            return await ReadStatusAsync(candidate, session, ct);
        }
        finally
        {
            await TryLogoutAsync(candidate, session.Sid);
        }
    }

    private async Task<AdBlockerStatus> ReadStatusAsync(PiHoleSettings settings, ISession session, CancellationToken ct)
    {
        try
        {
            var blocking = await SendAsync<PiHoleBlockingResponse>(settings, session, HttpMethod.Get, "api/dns/blocking", null, ct);
            var summary = await SendAsync<PiHoleSummaryResponse>(settings, session, HttpMethod.Get, "api/stats/summary", null, ct);

            return new AdBlockerStatus(
                Configured: true,
                Reachable: true,
                BlockingEnabled: blocking.Blocking switch
                {
                    "enabled" => true,
                    "disabled" => false,
                    _ => null,
                },
                BlockingTimerSeconds: blocking.Timer,
                TotalQueries: summary.Queries?.Total,
                BlockedQueries: summary.Queries?.Blocked,
                PercentBlocked: summary.Queries is null ? null : Math.Round(summary.Queries.PercentBlocked, 2),
                ActiveClients: summary.Clients?.Active,
                DomainsOnBlocklist: summary.Gravity?.DomainsBeingBlocked,
                Message: null,
                CheckedAtUtc: DateTime.UtcNow);
        }
        catch (Exception ex) when (IsUpstreamFailure(ex) && !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Pi-hole status request failed.");

            return AdBlockerStatus.Unreachable(DescribeFailure(ex));
        }
    }

    private async Task<T> SendAsync<T>(
        PiHoleSettings settings,
        ISession session,
        HttpMethod method,
        string path,
        object? body,
        CancellationToken ct)
    {
        // Retry once with a fresh session when the current one has expired.
        for (int attempt = 0; ; attempt++)
        {
            string? sid = await session.GetSidAsync(ct);

            using var request = new HttpRequestMessage(method, BuildUri(settings, path));

            if (sid is not null)
            {
                request.Headers.Add(_sessionHeader, sid);
            }

            if (body is not null)
            {
                request.Content = CreateJsonContent(body);
            }

            using var response = await _httpClient.SendAsync(request, ct);

            if (response.StatusCode == HttpStatusCode.Unauthorized && attempt == 0)
            {
                session.Invalidate();
                continue;
            }

            response.EnsureSuccessStatusCode();

            return await response.Content.ReadFromJsonAsync<T>(ct)
                ?? throw new JsonException($"Pi-hole returned an empty response for {path}.");
        }
    }

    private async Task<string?> AuthenticateAsync(PiHoleSettings settings, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(settings.Password))
        {
            return null;
        }

        using var response = await _httpClient.PostAsync(
            BuildUri(settings, "api/auth"),
            CreateJsonContent(new PiHoleAuthRequest(settings.Password)),
            ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new PiHoleAuthenticationException("Pi-hole rejected the password.");
        }

        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<PiHoleAuthResponse>(ct);

        if (auth?.Session is not { Valid: true })
        {
            throw new PiHoleAuthenticationException(auth?.Session?.Message ?? "Pi-hole did not create a session.");
        }

        return auth.Session.Sid;
    }

    private async Task TryLogoutAsync(PiHoleSettings settings, string? sid)
    {
        if (sid is null)
        {
            return;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Delete, BuildUri(settings, "api/auth"));
            request.Headers.Add(_sessionHeader, sid);
            using var _ = await _httpClient.SendAsync(request);
        }
        catch (Exception ex) when (IsUpstreamFailure(ex))
        {
            _logger.LogDebug(ex, "Logging out of the Pi-hole test session failed.");
        }
    }

    private CachedSessionAdapter CachedSession(PiHoleSettings settings) =>
        new(_sessionStore, settings, ct => AuthenticateAsync(settings, ct));

    // Buffered (not chunked) JSON with an explicit Content-Length, which the embedded
    // web server of Pi-hole handles reliably.
    private static StringContent CreateJsonContent(object body)
    {
        return new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
    }

    private static Uri BuildUri(PiHoleSettings settings, string path)
    {
        var baseUri = new Uri(settings.BaseUrl.TrimEnd('/') + "/");

        return new Uri(baseUri, path);
    }

    private static bool IsUpstreamFailure(Exception ex)
    {
        return ex is HttpRequestException
            or TaskCanceledException
            or JsonException
            or NotSupportedException
            or UriFormatException
            or PiHoleAuthenticationException;
    }

    private static string DescribeFailure(Exception ex)
    {
        return ex switch
        {
            PiHoleAuthenticationException => ex.Message,
            TaskCanceledException => "Pi-hole did not respond in time.",
            HttpRequestException { StatusCode: not null } http => $"Pi-hole responded with HTTP {(int)http.StatusCode.Value}.",
            HttpRequestException => "Pi-hole could not be reached.",
            UriFormatException => "The Pi-hole address is not a valid URL.",
            _ => "Pi-hole returned an unexpected response.",
        };
    }

    private interface ISession
    {
        Task<string?> GetSidAsync(CancellationToken ct);

        void Invalidate();
    }

    private sealed class CachedSessionAdapter(
        PiHoleSessionStore store,
        PiHoleSettings settings,
        Func<CancellationToken, Task<string?>> authenticate) : ISession
    {
        public Task<string?> GetSidAsync(CancellationToken ct) => store.GetOrCreateAsync(settings, authenticate, ct);

        public void Invalidate() => store.Invalidate();
    }

    private sealed class OneOffSession(Func<CancellationToken, Task<string?>> authenticate) : ISession
    {
        private bool _authenticated;

        public string? Sid { get; private set; }

        public async Task<string?> GetSidAsync(CancellationToken ct)
        {
            if (!_authenticated)
            {
                Sid = await authenticate(ct);
                _authenticated = true;
            }

            return Sid;
        }

        public void Invalidate() => _authenticated = false;
    }
}

public sealed class PiHoleAuthenticationException(string message) : Exception(message);
