using Microsoft.AspNetCore.Mvc;
using NodePilot.Application.AdBlocking;
using NodePilot.Application.AdBlocking.Errors;
using NodePilot.Application.AdBlocking.Settings;
using NodePilot.Application.Interfaces.AdBlocking;

namespace NodePilot.Api.Controllers;

/// <summary>Settings that can be changed from the NodePilot interface.</summary>
[Route("api/settings")]
public class SettingsController : BaseController
{
    private readonly IPiHoleSettingsStore _piHoleSettings;
    private readonly IAdBlockerService _adBlocker;

    public SettingsController(IPiHoleSettingsStore piHoleSettings, IAdBlockerService adBlocker)
    {
        _piHoleSettings = piHoleSettings;
        _adBlocker = adBlocker;
    }

    /// <summary>Current Pi-hole connection. The password is never returned, only whether one is set.</summary>
    [HttpGet("pihole")]
    public async Task<IActionResult> GetPiHoleAsync(CancellationToken ct)
    {
        return Ok(await _piHoleSettings.GetInfoAsync(ct));
    }

    /// <param name="request">
    /// <c>Password = null</c> keeps the saved password, an empty string removes it.
    /// </param>
    [HttpPut("pihole")]
    public async Task<IActionResult> SavePiHoleAsync([FromBody] PiHoleSettingsRequest request, CancellationToken ct)
    {
        var result = await _piHoleSettings.SaveAsync(request.BaseUrl, request.Password, ct);

        return result.Match(onValue: Ok, onError: Problem);
    }

    [HttpDelete("pihole")]
    public async Task<IActionResult> DisconnectPiHoleAsync(CancellationToken ct)
    {
        await _piHoleSettings.ClearAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Tries the given address and password without saving them. When no password is sent,
    /// the saved one is used, so an existing connection can be re-tested.
    /// </summary>
    [HttpPost("pihole/test")]
    public async Task<IActionResult> TestPiHoleAsync([FromBody] PiHoleSettingsRequest request, CancellationToken ct)
    {
        if (!PiHoleUrl.TryNormalize(request.BaseUrl, out string baseUrl))
        {
            return Problem([AdBlockerErrors.InvalidUrl]);
        }

        string password = request.Password ?? (await _piHoleSettings.GetEffectiveAsync(ct)).Password;

        var status = await _adBlocker.TestConnectionAsync(
            new PiHoleSettings { BaseUrl = baseUrl, Password = password, RequestTimeoutSeconds = 5 },
            ct);

        return Ok(status);
    }
}

public sealed record PiHoleSettingsRequest(string? BaseUrl, string? Password);
