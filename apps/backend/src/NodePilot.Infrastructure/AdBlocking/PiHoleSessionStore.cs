namespace NodePilot.Infrastructure.AdBlocking;

/// <summary>
/// Caches the Pi-hole session id across requests. Pi-hole limits the number of concurrent
/// sessions, so logging in on every call would quickly exhaust them.
/// </summary>
public sealed class PiHoleSessionStore
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    private string? _sid;

    private bool _authenticated;

    public async Task<string?> GetOrCreateAsync(
        Func<CancellationToken, Task<string?>> authenticate,
        CancellationToken ct)
    {
        if (_authenticated)
        {
            return _sid;
        }

        await _gate.WaitAsync(ct);

        try
        {
            if (!_authenticated)
            {
                _sid = await authenticate(ct);
                _authenticated = true;
            }

            return _sid;
        }
        finally
        {
            _gate.Release();
        }
    }

    public void Invalidate()
    {
        _authenticated = false;
        _sid = null;
    }
}
