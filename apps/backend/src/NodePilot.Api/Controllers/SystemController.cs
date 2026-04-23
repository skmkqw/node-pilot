using Microsoft.AspNetCore.Mvc;
using NodePilot.Application.Interfaces.SystemStatus;

namespace NodePilot.Api.Controllers;

[Route("api/[controller]")]
public class SystemController : BaseController
{
    private readonly ISystemMetricsReader _systemMetricsReader;

    public SystemController(ISystemMetricsReader metricsReader)
    {
        _systemMetricsReader = metricsReader;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetSystemStatus(CancellationToken ct = default)
    {
        var getSystemStatusResult = await _systemMetricsReader.ReadSystemStatusAsync(ct);

        return getSystemStatusResult.Match(onValue: Ok, onError: Problem);
    }
}