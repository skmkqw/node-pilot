using System.Security.Cryptography;
using System.Text;
using NodePilot.Application.AdBlocking.Settings;

namespace NodePilot.Infrastructure.AdBlocking;

/// <summary>
/// Caches the Pi-hole session id across requests. Pi-hole limits the number of concurrent
/// sessions, so logging in on every call would quickly exhaust them. The session is tied to
/// the URL and password it was created with and is replaced as soon as either changes.
/// </summary>
public sealed class PiHoleSessionStore
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    private string? _sid;

    private string? _fingerprint;

    public async Task<string?> GetOrCreateAsync(
        PiHoleSettings settings,
        Func<CancellationToken, Task<string?>> authenticate,
        CancellationToken ct)
    {
        string fingerprint = Fingerprint(settings);

        if (_fingerprint == fingerprint)
        {
            return _sid;
        }

        await _gate.WaitAsync(ct);

        try
        {
            if (_fingerprint != fingerprint)
            {
                _sid = await authenticate(ct);
                _fingerprint = fingerprint;
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
        _fingerprint = null;
        _sid = null;
    }

    private static string Fingerprint(PiHoleSettings settings)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{settings.BaseUrl}\n{settings.Password}"));
        return Convert.ToHexString(hash);
    }
}
