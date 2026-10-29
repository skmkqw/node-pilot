using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;

namespace NodePilot.Api.Auth;

public static class AuthenticationExtensions
{
    public const string CookieName = "nodepilot.session";

    /// <summary>Users, invitations and service settings.</summary>
    public const string AdminPolicy = "Admin";

    public static IServiceCollection AddCookieAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddOptions<AuthSettings>()
            .Bind(configuration.GetSection(AuthSettings.SectionName))
            .Validate(
                settings => settings.SessionLifetimeHours is >= 1 and <= 24 * 30,
                "Auth:SessionLifetimeHours must be between 1 and 720.")
            .Validate(
                settings => settings.LoginAttemptsPerMinute is >= 1 and <= 10_000,
                "Auth:LoginAttemptsPerMinute must be between 1 and 10000.")
            .ValidateOnStart();

        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.SlidingExpiration = true;

                // This is an API: answer with status codes instead of redirecting to a login page.
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
                options.Events.OnValidatePrincipal = ValidateAccountAsync;
            });

        services
            .AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
            .Configure<IOptions<AuthSettings>>((options, authSettings) =>
                options.ExpireTimeSpan = TimeSpan.FromHours(authSettings.Value.SessionLifetimeHours));

        // Every endpoint requires a signed-in user unless it explicitly opts out.
        services
            .AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build())
            .AddPolicy(AdminPolicy, policy => policy
                .RequireAuthenticatedUser()
                .RequireRole(nameof(UserRole.Admin)));

        return services;
    }

    /// <summary>
    /// Runs for every request with a session cookie. A removed account is signed out at once,
    /// and a changed role takes effect immediately instead of when the cookie expires.
    /// </summary>
    private static async Task ValidateAccountAsync(CookieValidatePrincipalContext context)
    {
        int? userId = context.Principal?.GetUserId();
        var accounts = context.HttpContext.RequestServices.GetRequiredService<IUserAccountRepository>();
        var account = userId is null ? null : await accounts.GetByIdAsync(userId.Value, context.HttpContext.RequestAborted);

        if (account is null)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        if (context.Principal!.FindFirstValue(ClaimTypes.Role) != account.Role.ToString())
        {
            context.ReplacePrincipal(AccountPrincipal.Create(account));
            context.ShouldRenew = true;
        }
    }
}
