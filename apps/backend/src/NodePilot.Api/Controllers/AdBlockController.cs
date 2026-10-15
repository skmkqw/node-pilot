using Microsoft.AspNetCore.Mvc;
using NodePilot.Application.Interfaces.AdBlocking;

namespace NodePilot.Api.Controllers;

[Route("api/adblock")]
public class AdBlockController : BaseController
{
    private readonly IAdBlockerService _adBlocker;

    public AdBlockController(IAdBlockerService adBlocker)
    {
        _adBlocker = adBlocker;
    }

    [HttpGet]
    public async Task<IActionResult> GetStatusAsync(CancellationToken ct)
    {
        return Ok(await _adBlocker.GetStatusAsync(ct));
    }

    [HttpPost("blocking")]
    public async Task<IActionResult> SetBlockingAsync([FromBody] SetBlockingRequest request, CancellationToken ct)
    {
        var result = await _adBlocker.SetBlockingAsync(request.Enabled, request.DurationSeconds, ct);

        return result.Match(onValue: Ok, onError: Problem);
    }
}

/// <param name="DurationSeconds">Optional: revert automatically after this many seconds.</param>
public sealed record SetBlockingRequest(bool Enabled, int? DurationSeconds);
