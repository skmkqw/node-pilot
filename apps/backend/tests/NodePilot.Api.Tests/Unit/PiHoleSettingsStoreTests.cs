using Microsoft.Extensions.Options;
using NodePilot.Application.AdBlocking.Errors;
using NodePilot.Application.AdBlocking.Models;
using NodePilot.Application.AdBlocking.Settings;
using NodePilot.Application.Interfaces.Security;
using NodePilot.Application.Interfaces.Settings;
using NodePilot.Infrastructure.AdBlocking;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class PiHoleSettingsStoreTests
{
    private InMemorySettings _settings = null!;

    [SetUp]
    public void SetUp() => _settings = new InMemorySettings();

    [Test]
    public async Task NothingConfigured_ReportsSourceNone()
    {
        var store = CreateStore();

        var info = await store.GetInfoAsync();

        Assert.That(info.Source, Is.EqualTo(PiHoleSettingsSource.None));
        Assert.That((await store.GetEffectiveAsync()).IsConfigured, Is.False);
    }

    [Test]
    public async Task Save_NormalisesUrlAndEncryptsPassword()
    {
        var store = CreateStore();

        var info = await store.SaveAsync(" http://192.168.1.2/ ", "app-password");

        Assert.That(info.Value, Is.EqualTo(new PiHoleConnectionInfo("http://192.168.1.2", true, PiHoleSettingsSource.App)));
        Assert.That(_settings.Values["pihole.password"], Is.Not.EqualTo("app-password"), "stored encrypted");
        Assert.That((await store.GetEffectiveAsync()).Password, Is.EqualTo("app-password"));
    }

    [Test]
    public async Task Save_NullPasswordKeepsExisting_EmptyRemovesIt()
    {
        var store = CreateStore();
        await store.SaveAsync("http://pi.hole", "secret-one");

        await store.SaveAsync("http://pi.hole:8080", null);
        Assert.That((await store.GetEffectiveAsync()).Password, Is.EqualTo("secret-one"));

        await store.SaveAsync("http://pi.hole:8080", string.Empty);
        Assert.That((await store.GetInfoAsync()).HasPassword, Is.False);
    }

    [TestCase("")]
    [TestCase("192.168.1.2")]
    [TestCase("ftp://192.168.1.2")]
    [TestCase("http://pi.hole/?x=1")]
    public async Task Save_InvalidUrl_ReturnsValidationError(string url)
    {
        var result = await CreateStore().SaveAsync(url, "x");

        Assert.That(result.FirstError, Is.EqualTo(AdBlockerErrors.InvalidUrl));
    }

    [Test]
    public async Task EnvironmentFallback_IsUsedUntilAppSettingsExist()
    {
        var store = CreateStore(new PiHoleSettings { BaseUrl = "http://env-pihole", Password = "env-pass" });

        Assert.That((await store.GetInfoAsync()).Source, Is.EqualTo(PiHoleSettingsSource.Environment));
        Assert.That((await store.GetEffectiveAsync()).BaseUrl, Is.EqualTo("http://env-pihole"));

        await store.SaveAsync("http://app-pihole", "app-pass");

        Assert.That((await store.GetInfoAsync()).Source, Is.EqualTo(PiHoleSettingsSource.App));
        Assert.That((await store.GetEffectiveAsync()).Password, Is.EqualTo("app-pass"));

        await store.ClearAsync();

        Assert.That((await store.GetEffectiveAsync()).BaseUrl, Is.EqualTo("http://env-pihole"));
    }

    private PiHoleSettingsStore CreateStore(PiHoleSettings? configured = null) =>
        new(_settings, new ReversingProtector(), new StaticMonitor(configured ?? new PiHoleSettings()));

    private sealed class InMemorySettings : IAppSettingsRepository
    {
        public Dictionary<string, string> Values { get; } = [];

        public Task<string?> GetAsync(string key, CancellationToken ct = default) =>
            Task.FromResult(Values.GetValueOrDefault(key));

        public Task SetAsync(string key, string value, CancellationToken ct = default)
        {
            Values[key] = value;
            return Task.CompletedTask;
        }

        public Task RemoveAsync(string key, CancellationToken ct = default)
        {
            Values.Remove(key);
            return Task.CompletedTask;
        }
    }

    /// <summary>Stand-in for Data Protection: reversible, but never stores the plain text.</summary>
    private sealed class ReversingProtector : ISecretProtector
    {
        public string Protect(string plaintext) => "enc:" + new string(plaintext.Reverse().ToArray());

        public string? Unprotect(string protectedValue) =>
            protectedValue.StartsWith("enc:") ? new string(protectedValue[4..].Reverse().ToArray()) : null;
    }

    private sealed class StaticMonitor(PiHoleSettings value) : IOptionsMonitor<PiHoleSettings>
    {
        public PiHoleSettings CurrentValue => value;

        public PiHoleSettings Get(string? name) => value;

        public IDisposable? OnChange(Action<PiHoleSettings, string?> listener) => null;
    }
}
