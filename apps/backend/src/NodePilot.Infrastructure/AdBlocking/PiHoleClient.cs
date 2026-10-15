using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ErrorOr;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
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
    private readonly IOptionsMonitor<PiHoleSettings> _settings;
    private readonly PiHoleSessionStore _sessionStore;
    private readonly ILogger<PiHoleClient> _logger;

    public PiHoleClient(
        HttpClient httpClient,
        IOptionsMonitor<PiHoleSettings> settings,
        PiHoleSessionStore sessionStore,
        ILogger<PiHoleClient> logger)
    {
        _httpClient = httpClient;
        _settings = settings;
        _sessionStore = sessionStore;
        _logger = logger;
    }

    public async Task<AdBlockerStatus> GetStatusAsync(CancellationToken ct = default)
    {
        if (!_settings.CurrentValue.IsConfigured)
        {
            return AdBlockerStatus.NotConfigured();
        }

        try
        {
            var blocking = await SendAsync<PiHoleBlockingResponse>(HttpMethod.Get, "api/dns/blocking", null, ct);
            var summary = await SendAsync<PiHoleSummaryResponse>(HttpMethod.Get, "api/stats/summary", null, ct);

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

    public async Task<ErrorOr<AdBlockerStatus>> SetBlockingAsync(
        bool enabled,
        int? durationSeconds,
        CancellationToken ct = default)
    {
        if (!_settings.CurrentValue.IsConfigured)
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

        return await GetStatusAsync(ct);
    }

    private async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        // Retry once with a fresh session when the cached one has expired.
        for (int attempt = 0; ; attempt++)
        {
            string? sid = await _sessionStore.GetOrCreateAsync(AuthenticateAsync, ct);

            using var request = new HttpRequestMessage(method, BuildUri(path));

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
                _sessionStore.Invalidate();
                continue;
            }

            response.EnsureSuccessStatusCode();

            return await response.Content.ReadFromJsonAsync<T>(ct)
                ?? throw new JsonException($"Pi-hole returned an empty response for {path}.");
        }
    }

    private async Task<string?> AuthenticateAsync(CancellationToken ct)
    {
        string password = _settings.CurrentValue.Password;

        if (string.IsNullOrEmpty(password))
        {
            return null;
        }

        using var response = await _httpClient.PostAsync(
            BuildUri("api/auth"),
            CreateJsonContent(new PiHoleAuthRequest(password)),
            ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new PiHoleAuthenticationException("Pi-hole rejected the configured password.");
        }

        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<PiHoleAuthResponse>(ct);

        if (auth?.Session is not { Valid: true })
        {
            throw new PiHoleAuthenticationException(auth?.Session?.Message ?? "Pi-hole did not create a session.");
        }

        return auth.Session.Sid;
    }

    // Buffered (not chunked) JSON with an explicit Content-Length, which the embedded
    // web server of Pi-hole handles reliably.
    private static StringContent CreateJsonContent(object body)
    {
        return new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
    }

    private Uri BuildUri(string path)
    {
        var baseUri = new Uri(_settings.CurrentValue.BaseUrl.TrimEnd('/') + "/");

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
            UriFormatException => "PiHole:BaseUrl is not a valid URL.",
            _ => "Pi-hole returned an unexpected response.",
        };
    }
}

public sealed class PiHoleAuthenticationException(string message) : Exception(message);
