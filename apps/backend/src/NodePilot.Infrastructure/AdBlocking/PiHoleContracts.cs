using System.Text.Json.Serialization;

namespace NodePilot.Infrastructure.AdBlocking;

// Minimal subset of the Pi-hole v6 REST API (https://docs.pi-hole.net/api/).

internal sealed record PiHoleAuthRequest([property: JsonPropertyName("password")] string Password);

internal sealed record PiHoleAuthResponse([property: JsonPropertyName("session")] PiHoleSession? Session);

internal sealed record PiHoleSession(
    [property: JsonPropertyName("valid")] bool Valid,
    [property: JsonPropertyName("sid")] string? Sid,
    [property: JsonPropertyName("message")] string? Message);

internal sealed record PiHoleBlockingRequest(
    [property: JsonPropertyName("blocking")] bool Blocking,
    [property: JsonPropertyName("timer")] int? Timer);

/// <param name="Blocking">One of <c>enabled</c>, <c>disabled</c>, <c>failed</c>, <c>unknown</c>.</param>
internal sealed record PiHoleBlockingResponse(
    [property: JsonPropertyName("blocking")] string? Blocking,
    [property: JsonPropertyName("timer")] double? Timer);

internal sealed record PiHoleSummaryResponse(
    [property: JsonPropertyName("queries")] PiHoleQueries? Queries,
    [property: JsonPropertyName("clients")] PiHoleClients? Clients,
    [property: JsonPropertyName("gravity")] PiHoleGravity? Gravity);

internal sealed record PiHoleQueries(
    [property: JsonPropertyName("total")] long Total,
    [property: JsonPropertyName("blocked")] long Blocked,
    [property: JsonPropertyName("percent_blocked")] double PercentBlocked);

internal sealed record PiHoleClients(
    [property: JsonPropertyName("active")] int Active,
    [property: JsonPropertyName("total")] int Total);

internal sealed record PiHoleGravity(
    [property: JsonPropertyName("domains_being_blocked")] long DomainsBeingBlocked);
