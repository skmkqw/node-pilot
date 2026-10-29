using System.Threading.RateLimiting;
using Microsoft.Extensions.Options;

namespace NodePilot.Api.Auth;

public static class RateLimitingExtensions
{
    public const string LoginPolicy = "login";

    private static readonly TimeSpan _loginWindow = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Limits login and setup attempts per client IP to slow down password guessing
    /// (<c>Auth:LoginAttemptsPerMinute</c>, default 5).
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
                        PermitLimit = context.RequestServices
                            .GetRequiredService<IOptions<AuthSettings>>().Value.LoginAttemptsPerMinute,
                        Window = _loginWindow,
                        QueueLimit = 0,
                    }));
        });

        return services;
    }
}
