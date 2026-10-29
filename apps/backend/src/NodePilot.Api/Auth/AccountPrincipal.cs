using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using NodePilot.Application.Accounts.Models;

namespace NodePilot.Api.Auth;

/// <summary>Builds the claims stored in the session cookie.</summary>
public static class AccountPrincipal
{
    public static ClaimsPrincipal Create(UserAccount account)
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
                new Claim(ClaimTypes.Name, account.Username),
                new Claim(ClaimTypes.Role, account.Role.ToString()),
            ],
            CookieAuthenticationDefaults.AuthenticationScheme);

        return new ClaimsPrincipal(identity);
    }

    public static int? GetUserId(this ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out int id) ? id : null;

    /// <summary>Issues the session cookie for <paramref name="account"/>.</summary>
    public static Task SignInAsAsync(this HttpContext context, UserAccount account, bool isPersistent) =>
        context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            Create(account),
            new AuthenticationProperties { IsPersistent = isPersistent });
}
