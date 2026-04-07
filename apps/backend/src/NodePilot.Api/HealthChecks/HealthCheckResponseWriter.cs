using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace NodePilot.Api.HealthChecks;

public static class HealthCheckResponseWriter
{
    public static async Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";

        var payload = new
        {
            status = report.Status.ToString(),
            totalDuration = report.TotalDuration,
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                description = entry.Value.Description,
                duration = entry.Value.Duration,
                tags = entry.Value.Tags,
                data = entry.Value.Data,
            }),
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
