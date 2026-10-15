namespace NodePilot.Api.Cors;

public sealed class CorsSettings
{
    public const string SectionName = "Cors";

    public string[] AllowedOrigins { get; init; } = [];

    /// <summary>
    /// Also allow web clients served from localhost, private IPv4/IPv6 ranges and
    /// <c>.local</c> hosts, so the panel works from any device in the home network.
    /// </summary>
    public bool AllowPrivateNetworkOrigins { get; init; }
}
