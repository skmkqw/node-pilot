using ErrorOr;
using Microsoft.Extensions.Options;
using NodePilot.Application.AdBlocking;
using NodePilot.Application.AdBlocking.Errors;
using NodePilot.Application.AdBlocking.Models;
using NodePilot.Application.AdBlocking.Settings;
using NodePilot.Application.Interfaces.AdBlocking;
using NodePilot.Application.Interfaces.Security;
using NodePilot.Application.Interfaces.Settings;

namespace NodePilot.Infrastructure.AdBlocking;

public sealed class PiHoleSettingsStore : IPiHoleSettingsStore
{
    private const string _baseUrlKey = "pihole.base_url";
    private const string _passwordKey = "pihole.password";

    private readonly IAppSettingsRepository _settings;
    private readonly ISecretProtector _protector;
    private readonly IOptionsMonitor<PiHoleSettings> _configured;

    public PiHoleSettingsStore(
        IAppSettingsRepository settings,
        ISecretProtector protector,
        IOptionsMonitor<PiHoleSettings> configured)
    {
        _settings = settings;
        _protector = protector;
        _configured = configured;
    }

    public async Task<PiHoleSettings> GetEffectiveAsync(CancellationToken ct = default)
    {
        var fallback = _configured.CurrentValue;
        string? baseUrl = await _settings.GetAsync(_baseUrlKey, ct);

        if (string.IsNullOrEmpty(baseUrl))
        {
            return fallback;
        }

        string? storedPassword = await _settings.GetAsync(_passwordKey, ct);

        return new PiHoleSettings
        {
            BaseUrl = baseUrl,
            Password = storedPassword is null ? string.Empty : _protector.Unprotect(storedPassword) ?? string.Empty,
            RequestTimeoutSeconds = fallback.RequestTimeoutSeconds,
        };
    }

    public async Task<PiHoleConnectionInfo> GetInfoAsync(CancellationToken ct = default)
    {
        string? baseUrl = await _settings.GetAsync(_baseUrlKey, ct);

        if (!string.IsNullOrEmpty(baseUrl))
        {
            bool hasPassword = await _settings.GetAsync(_passwordKey, ct) is not null;
            return new PiHoleConnectionInfo(baseUrl, hasPassword, PiHoleSettingsSource.App);
        }

        var configured = _configured.CurrentValue;

        return configured.IsConfigured
            ? new PiHoleConnectionInfo(configured.BaseUrl, !string.IsNullOrEmpty(configured.Password), PiHoleSettingsSource.Environment)
            : new PiHoleConnectionInfo(null, false, PiHoleSettingsSource.None);
    }

    public async Task<ErrorOr<PiHoleConnectionInfo>> SaveAsync(string? baseUrl, string? password, CancellationToken ct = default)
    {
        if (!PiHoleUrl.TryNormalize(baseUrl, out string normalized))
        {
            return AdBlockerErrors.InvalidUrl;
        }

        await _settings.SetAsync(_baseUrlKey, normalized, ct);

        if (password is not null)
        {
            if (password.Length == 0)
            {
                await _settings.RemoveAsync(_passwordKey, ct);
            }
            else
            {
                await _settings.SetAsync(_passwordKey, _protector.Protect(password), ct);
            }
        }

        return await GetInfoAsync(ct);
    }

    public async Task ClearAsync(CancellationToken ct = default)
    {
        await _settings.RemoveAsync(_baseUrlKey, ct);
        await _settings.RemoveAsync(_passwordKey, ct);
    }
}
