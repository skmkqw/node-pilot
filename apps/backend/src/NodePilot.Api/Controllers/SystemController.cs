using Microsoft.AspNetCore.Mvc;
using NodePilot.Application.SystemStatus.Services;

namespace NodePilot.Api.Controllers;

[Route("api/[controller]")]
public class SystemController : BaseController
{
    private readonly ISystemStatusService _systemStatusService;

    public SystemController(ISystemStatusService systemStatusService)
    {
        _systemStatusService = systemStatusService;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetSystemStatus()
    {
        var getSystemStatusResult = await _systemStatusService.GetSystemStatusAsync();

        return getSystemStatusResult.Match(onValue: Ok, onError: Problem);
    }
}