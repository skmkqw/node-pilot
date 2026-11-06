namespace NodePilot.Api.ReverseProxy;

/// <summary>
/// Trust for <c>X-Forwarded-For</c> / <c>X-Forwarded-Proto</c> from a reverse proxy (nginx, Caddy, ...).
/// The headers are only honoured when the connection comes from one of these addresses,
/// otherwise any client could pick its own IP and bypass the login rate limit.
/// </summary>
public sealed class ReverseProxySettings
{
    public const string SectionName = "ReverseProxy";

    public bool Enabled { get; init; }

    /// <summary>Proxy addresses, e.g. <c>127.0.0.1</c> for nginx on the same host.</summary>
    public string[] KnownProxies { get; init; } = [];

    /// <summary>Proxy networks in CIDR notation, e.g. <c>172.16.0.0/12</c> when the backend runs in Docker.</summary>
    public string[] KnownNetworks { get; init; } = [];
}
