using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NodePilot.Api.Auth;
using NodePilot.Application.Accounts.Errors;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;

namespace NodePilot.Api.Controllers;

/// <summary>Account management for administrators.</summary>
[Route("api/users")]
[Authorize(Policy = AuthenticationExtensions.AdminPolicy)]
public class UsersController : BaseController
{
    private readonly IAccountService _accounts;

    public UsersController(IAccountService accounts)
    {
        _accounts = accounts;
    }

    [HttpGet]
    public async Task<IActionResult> ListAsync(CancellationToken ct)
    {
        return Ok(await _accounts.ListUsersAsync(ct));
    }

    [HttpPut("{id:int}/role")]
    public async Task<IActionResult> ChangeRoleAsync(int id, [FromBody] ChangeRoleRequest request, CancellationToken ct)
    {
        // Nullable so that a missing role is rejected instead of defaulting to Admin (= 0).
        if (request.Role is not UserRole role)
        {
            return Problem([AccountErrors.InvalidRole]);
        }

        var result = await _accounts.ChangeRoleAsync(User.GetUserId() ?? 0, id, role, ct);

        return result.Match(onValue: Ok, onError: Problem);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> RemoveAsync(int id, CancellationToken ct)
    {
        var result = await _accounts.RemoveUserAsync(User.GetUserId() ?? 0, id, ct);

        return result.Match(_ => NoContent(), Problem);
    }
}

public sealed record ChangeRoleRequest(UserRole? Role);
