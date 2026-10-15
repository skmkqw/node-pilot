using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using NodePilot.Api.Auth;

namespace NodePilot.Api.Controllers;

[Route("api/auth")]
public class AuthController : BaseController
{
    private readonly IOptionsMonitor<AuthSettings> _authSettings;

    public AuthController(IOptionsMonitor<AuthSettings> authSettings)
    {
        _authSettings = authSettings;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> LoginAsync([FromBody] LoginRequest request)
    {
        var settings = _authSettings.CurrentValue;

        bool usernameMatches = FixedTimeEquals(request.Username, settings.Username);
        bool passwordMatches = FixedTimeEquals(request.Password, settings.Password);

        if (!usernameMatches || !passwordMatches)
        {
            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Invalid username or password.");
        }

        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, settings.Username)],
            CookieAuthenticationDefaults.AuthenticationScheme);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = request.RememberMe });

        return Ok(new CurrentUserResponse(settings.Username));
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

    // Hashing both sides first gives equal-length inputs, so the comparison time
    // does not leak how many leading characters were correct.
    private static bool FixedTimeEquals(string? provided, string expected)
    {
        byte[] providedHash = SHA256.HashData(Encoding.UTF8.GetBytes(provided ?? string.Empty));
        byte[] expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(expected));

        return CryptographicOperations.FixedTimeEquals(providedHash, expectedHash);
    }
}

public sealed record LoginRequest(string? Username, string? Password, bool RememberMe = false);

public sealed record CurrentUserResponse(string Username);
