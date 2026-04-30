
namespace NodePilot.Application.SystemStatus;

public sealed class MetricsCollectorState
{
    private readonly Lock _lock = new();

    public DateTimeOffset? LastSuccessfulCollectionUtc { get; private set; }

    public DateTimeOffset? LastAttemptUtc { get; private set; }
    
    public string? LastError { get; private set; }
    
    public bool IsRunning { get; private set; }

    public void MarkRunning()
    {
        lock (_lock)
        {
            IsRunning = true;
        }
    }

    public void MarkStopped()
    {
        lock (_lock)
        {
            IsRunning = false;
        }
    }

    public void MarkSuccess(DateTimeOffset timestampUtc)
    {
        lock (_lock)
        {
            LastAttemptUtc = timestampUtc;
            LastSuccessfulCollectionUtc = timestampUtc;
            LastError = null;
        }
    }

    public void MarkFailure(DateTimeOffset timestampUtc, string error)
    {
        lock (_lock)
        {
            LastAttemptUtc = timestampUtc;
            LastError = error;
        }
    }

    public CollectorStateSnapshot Snapshot()
    {
        lock (_lock)
        {
            return new CollectorStateSnapshot(
                IsRunning,
                LastSuccessfulCollectionUtc,
                LastAttemptUtc,
                LastError);
        }
    }
}

public sealed record CollectorStateSnapshot(
    bool IsRunning,
    DateTimeOffset? LastSuccessfulCollectionUtc,
    DateTimeOffset? LastAttemptUtc,
    string? LastError);