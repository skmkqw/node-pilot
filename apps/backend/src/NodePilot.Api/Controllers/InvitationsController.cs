using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NodePilot.Api.Auth;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;

namespace NodePilot.Api.Controllers;

/// <summary>Invite links, created and revoked by administrators.</summary>
[Route("api/invitations")]
[Authorize(Policy = AuthenticationExtensions.AdminPolicy)]
public class InvitationsController : BaseController
{
    private readonly IInvitationService _invitations;

    public InvitationsController(IInvitationService invitations)
    {
        _invitations = invitations;
    }

    /// <summary>Links that were neither used nor have expired.</summary>
    [HttpGet]
    public async Task<IActionResult> ListAsync(CancellationToken ct)
    {
        return Ok(await _invitations.ListPendingAsync(ct));
    }

    /// <summary>
    /// Creates a one-time link. The response contains the token; it is not stored and
    /// cannot be shown again.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateAsync([FromBody] CreateInvitationRequest request, CancellationToken ct)
    {
        var result = await _invitations.CreateAsync(User.GetUserId() ?? 0, request.Role, request.ValidForHours, ct);

        return result.Match(
            created => StatusCode(StatusCodes.Status201Created, created),
            Problem);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> RevokeAsync(int id, CancellationToken ct)
    {
        var result = await _invitations.RevokeAsync(id, ct);

        return result.Match(_ => NoContent(), Problem);
    }
}

/// <summary>Public side of an invite link: shown to the invited person, who is not signed in yet.</summary>
[Route("api/invite")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitingExtensions.LoginPolicy)]
public class InviteController : BaseController
{
    private readonly IInvitationService _invitations;

    public InviteController(IInvitationService invitations)
    {
        _invitations = invitations;
    }

    [HttpGet("{token}")]
    public async Task<IActionResult> PreviewAsync(string token, CancellationToken ct)
    {
        var result = await _invitations.PreviewAsync(token, ct);

        return result.Match(onValue: Ok, onError: Problem);
    }

    /// <summary>Creates the account and signs the new user in.</summary>
    [HttpPost("{token}/accept")]
    public async Task<IActionResult> AcceptAsync(string token, [FromBody] CredentialsRequest request, CancellationToken ct)
    {
        var result = await _invitations.AcceptAsync(token, request.Username, request.Password, ct);

        if (result.IsError)
        {
            return Problem(result.Errors);
        }

        await HttpContext.SignInAsAsync(result.Value, isPersistent: true);

        return StatusCode(StatusCodes.Status201Created, CurrentUserResponse.From(result.Value));
    }
}

public sealed record CreateInvitationRequest(UserRole Role = UserRole.Member, int ValidForHours = 24);
