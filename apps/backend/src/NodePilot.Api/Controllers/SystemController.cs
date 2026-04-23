using Microsoft.AspNetCore.Mvc;
using NodePilot.Application.Interfaces.SystemStatus;

namespace NodePilot.Api.Controllers;

[Route("api/[controller]")]
public class SystemController : BaseController
{
    private readonly ISystemMetricsProvider _metricsProvider;

    public SystemController(ISystemMetricsProvider metricsProvider)
    {
        _metricsProvider = metricsProvider;
    }

    [HttpGet("metrics/current")]
    public async Task<IActionResult> GetCurrentMetrics(CancellationToken ct = default)
    {
        var getCurrentMetricsResult = await _metricsProvider.GetCurrentMetricsAsync(ct);

        return getCurrentMetricsResult.Match(onValue: Ok, onError: Problem);
    }

    [HttpGet("metrics/historical")]
    public async Task<IActionResult> GetHistoricalMetrics([FromQuery] DateTime start,
        [FromQuery] DateTime end,
        [FromQuery] int? minIntervalSeconds,
        CancellationToken ct = default)
    {
        var getHistoricalMetricsResult =
            await _metricsProvider.GetHistoricalMetricsAsync(start, end, minIntervalSeconds, ct);

        return getHistoricalMetricsResult.Match(onValue: Ok, onError: Problem);
    }
}