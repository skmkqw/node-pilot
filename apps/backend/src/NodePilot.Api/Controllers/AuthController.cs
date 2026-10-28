using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NodePilot.Api.Auth;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;

namespace NodePilot.Api.Controllers;

[Route("api/auth")]
public class AuthController : BaseController
{
    private readonly IAccountService _accounts;

    public AuthController(IAccountService accounts)
    {
        _accounts = accounts;
    }

    /// <summary>
    /// Tells the web app which screen to show: first-start setup, login, or the panel.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("status")]
    public async Task<IActionResult> GetStatusAsync(CancellationToken ct)
    {
        bool setupRequired = await _accounts.IsSetupRequiredAsync(ct);
        bool authenticated = !setupRequired && User.Identity?.IsAuthenticated == true;

        return Ok(new AuthStatusResponse(setupRequired, authenticated, authenticated ? User.Identity!.Name : null));
    }

    /// <summary>Creates the administrator account. Only possible while no account exists.</summary>
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.LoginPolicy)]
    [HttpPost("setup")]
    public async Task<IActionResult> SetupAsync([FromBody] CredentialsRequest request, CancellationToken ct)
    {
        var result = await _accounts.CreateInitialAdminAsync(request.Username, request.Password, ct);

        if (result.IsError)
        {
            return Problem(result.Errors);
        }

        await SignInAsync(result.Value, isPersistent: true);

        return StatusCode(StatusCodes.Status201Created, new CurrentUserResponse(result.Value.Username));
    }

    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.LoginPolicy)]
    [HttpPost("login")]
    public async Task<IActionResult> LoginAsync([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await _accounts.ValidateCredentialsAsync(request.Username, request.Password, ct);

        if (result.IsError)
        {
            return Problem(result.Errors);
        }

        await SignInAsync(result.Value, request.RememberMe);

        return Ok(new CurrentUserResponse(result.Value.Username));
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> LogoutAsync()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

        return NoContent();
    }

    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        return Ok(new CurrentUserResponse(User.Identity?.Name ?? string.Empty));
    }

    [HttpPost("password")]
    public async Task<IActionResult> ChangePasswordAsync([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out int accountId))
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Please sign in again.");
        }

        var result = await _accounts.ChangePasswordAsync(accountId, request.CurrentPassword, request.NewPassword, ct);

        return result.Match(_ => NoContent(), Problem);
    }

    private Task SignInAsync(UserAccount account, bool isPersistent)
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
                new Claim(ClaimTypes.Name, account.Username),
            ],
            CookieAuthenticationDefaults.AuthenticationScheme);

        return HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = isPersistent });
    }
}

public sealed record CredentialsRequest(string? Username, string? Password);

public sealed record LoginRequest(string? Username, string? Password, bool RememberMe = false);

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

public sealed record CurrentUserResponse(string Username);

public sealed record AuthStatusResponse(bool SetupRequired, bool Authenticated, string? Username);
