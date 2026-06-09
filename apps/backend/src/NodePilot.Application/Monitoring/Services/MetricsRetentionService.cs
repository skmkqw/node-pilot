using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Monitoring.Services;

public sealed class MetricsRetentionService(ISystemMetricsRepository repository) : IMetricsRetentionService
{
    private readonly ISystemMetricsRepository _repository = repository;

    public async Task<RetentionResult> ApplyRetentionAsync(TimeSpan retention, CancellationToken ct)
    {
        var startedAtUtc = DateTime.UtcNow;

        var cutoff = startedAtUtc - retention;

        int deleted =
            await _repository.DeleteOlderThanAsync(cutoff, ct);

        var completedAtUtc = DateTime.UtcNow;

        return new RetentionResult(startedAtUtc, completedAtUtc, cutoff, deleted);
    }
}
