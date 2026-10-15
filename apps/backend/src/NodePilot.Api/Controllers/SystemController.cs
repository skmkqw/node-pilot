using Microsoft.AspNetCore.Mvc;
using NodePilot.Application.Interfaces.Monitoring;

namespace NodePilot.Api.Controllers;

[Route("api/[controller]")]
public class SystemController : BaseController
{
    private readonly ISystemMetricsProvider _metricsProvider;

    private readonly ISystemOverviewProvider _overviewProvider;

    public SystemController(
        ISystemMetricsProvider metricsProvider,
        ISystemOverviewProvider overviewProvider)
    {
        _metricsProvider = metricsProvider;
        _overviewProvider = overviewProvider;
    }

    [HttpGet("overview")]
    public IActionResult GetOverview()
    {
        return Ok(_overviewProvider.GetOverview());
    }

    [HttpGet("metrics/current")]
    public async Task<IActionResult> GetCurrentMetricsAsync(CancellationToken ct = default)
    {
        var getCurrentMetricsResult = await _metricsProvider.GetCurrentMetricsAsync(ct);

        return getCurrentMetricsResult.Match(onValue: Ok, onError: Problem);
    }

    [HttpGet("metrics/historical")]
    public async Task<IActionResult> GetHistoricalMetricsAsync([FromQuery] DateTime start,
        [FromQuery] DateTime end,
        [FromQuery] int? minIntervalSeconds,
        CancellationToken ct = default)
    {
        var getHistoricalMetricsResult =
            await _metricsProvider.GetHistoricalMetricsAsync(start, end, minIntervalSeconds, ct);

        return getHistoricalMetricsResult.Match(onValue: Ok, onError: Problem);
    }
}
