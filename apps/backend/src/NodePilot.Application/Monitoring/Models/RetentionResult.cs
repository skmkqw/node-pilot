namespace NodePilot.Application.Monitoring.Models;

public sealed record RetentionResult(
    DateTime StartedAtUtc,
    DateTime CompletedAtUtc,
    DateTime CutoffUtc,
    int DeletedMetrics
);
