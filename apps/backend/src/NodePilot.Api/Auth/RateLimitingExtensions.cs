using System.Threading.RateLimiting;

namespace NodePilot.Api.Auth;

public static class RateLimitingExtensions
{
    public const string LoginPolicy = "login";

    private const int _loginAttemptsPerWindow = 5;

    private static readonly TimeSpan _loginWindow = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Limits login attempts per client IP to slow down password guessing.
    /// </summary>
    public static IServiceCollection AddLoginRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddPolicy(LoginPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = _loginAttemptsPerWindow,
                        Window = _loginWindow,
                        QueueLimit = 0,
                    }));
        });

        return services;
    }
}
