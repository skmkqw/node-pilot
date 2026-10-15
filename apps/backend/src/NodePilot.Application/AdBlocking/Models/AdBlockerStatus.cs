namespace NodePilot.Application.AdBlocking.Models;

/// <summary>
/// State of the network ad blocker. Statistics are <c>null</c> when the blocker is not
/// configured or could not be reached.
/// </summary>
public sealed record AdBlockerStatus(
    bool Configured,
    bool Reachable,
    bool? BlockingEnabled,
    double? BlockingTimerSeconds,
    long? TotalQueries,
    long? BlockedQueries,
    double? PercentBlocked,
    int? ActiveClients,
    long? DomainsOnBlocklist,
    string? Message,
    DateTime CheckedAtUtc)
{
    public static AdBlockerStatus NotConfigured() => new(
        Configured: false,
        Reachable: false,
        BlockingEnabled: null,
        BlockingTimerSeconds: null,
        TotalQueries: null,
        BlockedQueries: null,
        PercentBlocked: null,
        ActiveClients: null,
        DomainsOnBlocklist: null,
        Message: "Pi-hole is not configured. Set PiHole__BaseUrl to enable the integration.",
        CheckedAtUtc: DateTime.UtcNow);

    public static AdBlockerStatus Unreachable(string message) => NotConfigured() with
    {
        Configured = true,
        Message = message,
    };
}
