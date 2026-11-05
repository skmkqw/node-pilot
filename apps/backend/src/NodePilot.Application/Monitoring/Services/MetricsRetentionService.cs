using NodePilot.Application.Interfaces.Monitoring;
using NodePilot.Application.Monitoring.Models;

namespace NodePilot.Application.Monitoring.Services;

public sealed class MetricsRetentionService(ISystemMetricsRepository repository) : IMetricsRetentionService
{
    private readonly ISystemMetricsRepository _repository = repository;

    public async Task<RetentionResult> ApplyRetentionAsync(TimeSpan retention, int maxStoredSamples, CancellationToken ct)
    {
        DateTime startedAtUtc = DateTime.UtcNow;
        DateTime cutoff = startedAtUtc - retention;

        int ageBasedDeleted = await _repository.DeleteOlderThanAsync(cutoff, ct);
        int amountBasedDeleted = await _repository.DeleteExceedingCountAsync(maxStoredSamples, ct);

        DateTime completedAtUtc = DateTime.UtcNow;

        return new RetentionResult(startedAtUtc, completedAtUtc, cutoff, ageBasedDeleted, amountBasedDeleted);
    }
}
