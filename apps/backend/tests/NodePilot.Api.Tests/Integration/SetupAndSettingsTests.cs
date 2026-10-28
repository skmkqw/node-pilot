using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NodePilot.Api.Tests.Integration;

[TestFixture]
[NonParallelizable]
public class SetupAndSettingsTests
{
    private NodePilotApiFactory _factory = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp() => _factory = new NodePilotApiFactory();

    [OneTimeTearDown]
    public void OneTimeTearDown() => _factory.Dispose();

    [Test, Order(1)]
    public async Task FreshInstall_RequiresSetup_AndBlocksTheApi()
    {
        var client = _factory.CreateClient();

        var status = await client.GetFromJsonAsync<JsonElement>("/api/auth/status");
        var files = await client.GetAsync("/api/files");

        Assert.That(status.GetProperty("setupRequired").GetBoolean(), Is.True);
        Assert.That(files.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test, Order(2)]
    public async Task Setup_CreatesAdministrator_SignsIn_AndClosesSetup()
    {
        var client = _factory.CreateClient();

        var setup = await client.PostAsJsonAsync("/api/auth/setup",
            new { username = NodePilotApiFactory.Username, password = NodePilotApiFactory.Password });
        var status = await client.GetFromJsonAsync<JsonElement>("/api/auth/status");
        var again = await _factory.CreateClient().PostAsJsonAsync("/api/auth/setup",
            new { username = "intruder", password = "intruder-password" });

        Assert.That(setup.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(status.GetProperty("setupRequired").GetBoolean(), Is.False);
        Assert.That(status.GetProperty("authenticated").GetBoolean(), Is.True, "setup signs the new administrator in");
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
    }

    [Test, Order(3)]
    public async Task ChangePassword_OldPasswordStopsWorking()
    {
        using var client = await _factory.CreateAuthenticatedClientAsync();

        var change = await client.PostAsJsonAsync("/api/auth/password",
            new { currentPassword = NodePilotApiFactory.Password, newPassword = "a-brand-new-password" });

        var oldLogin = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { username = NodePilotApiFactory.Username, password = NodePilotApiFactory.Password });
        var newLogin = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { username = NodePilotApiFactory.Username.ToUpperInvariant(), password = "a-brand-new-password" });

        // Restore the password for the following tests.
        await client.PostAsJsonAsync("/api/auth/password",
            new { currentPassword = "a-brand-new-password", newPassword = NodePilotApiFactory.Password });

        Assert.That(change.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(oldLogin.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(newLogin.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test, Order(4)]
    public async Task PiHoleSettings_SaveNeverReturnsPassword_AndCanBeCleared()
    {
        using var client = await _factory.CreateAuthenticatedClientAsync();

        var invalid = await client.PutAsJsonAsync("/api/settings/pihole", new { baseUrl = "not a url", password = "x" });
        var saved = await client.PutAsJsonAsync("/api/settings/pihole", new { baseUrl = "http://127.0.0.1:9/", password = "app-password" });
        string savedBody = await saved.Content.ReadAsStringAsync();
        var info = await client.GetFromJsonAsync<JsonElement>("/api/settings/pihole");
        var adblock = await client.GetFromJsonAsync<JsonElement>("/api/adblock");
        var cleared = await client.DeleteAsync("/api/settings/pihole");
        var afterClear = await client.GetFromJsonAsync<JsonElement>("/api/settings/pihole");

        Assert.That(invalid.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(saved.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(savedBody, Does.Not.Contain("app-password"));
        Assert.That(info.GetProperty("baseUrl").GetString(), Is.EqualTo("http://127.0.0.1:9"));
        Assert.That(info.GetProperty("hasPassword").GetBoolean(), Is.True);
        Assert.That(info.GetProperty("source").GetString(), Is.EqualTo("App"));
        Assert.That(adblock.GetProperty("configured").GetBoolean(), Is.True, "the ad blocker uses the saved settings");
        Assert.That(cleared.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(afterClear.GetProperty("source").GetString(), Is.EqualTo("None"));
    }

    [TestCase("/api/settings/pihole")]
    [TestCase("/api/auth/me")]
    public async Task SettingsEndpoints_RequireSignIn(string url)
    {
        var response = await _factory.CreateClient().GetAsync(url);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
