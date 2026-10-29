using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NodePilot.Api.Tests.Integration;

[TestFixture]
[NonParallelizable]
public class UsersAndInvitationsTests
{
    private const string _memberPassword = "member-password-123";

    private NodePilotApiFactory _factory = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp() => _factory = new NodePilotApiFactory();

    [OneTimeTearDown]
    public void OneTimeTearDown() => _factory.Dispose();

    [Test]
    public async Task InviteLink_CreatesMember_WhoCannotManageUsersOrSettings()
    {
        using var admin = await _factory.CreateAuthenticatedClientAsync();
        string token = await CreateInviteAsync(admin, "Member");

        using var guest = _factory.CreateClient();
        var preview = await guest.GetFromJsonAsync<JsonElement>($"/api/invite/{token}");
        var accept = await guest.PostAsJsonAsync($"/api/invite/{token}/accept", new { username = "anna", password = _memberPassword });
        var status = await guest.GetFromJsonAsync<JsonElement>("/api/auth/status");
        var reuse = await _factory.CreateClient().PostAsJsonAsync($"/api/invite/{token}/accept", new { username = "eve", password = _memberPassword });

        Assert.That(preview.GetProperty("role").GetString(), Is.EqualTo("Member"));
        Assert.That(preview.GetProperty("invitedBy").GetString(), Is.EqualTo(NodePilotApiFactory.Username));
        Assert.That(accept.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(status.GetProperty("authenticated").GetBoolean(), Is.True, "accepting signs the new user in");
        Assert.That(status.GetProperty("role").GetString(), Is.EqualTo("Member"));
        Assert.That(reuse.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), "a link works only once");

        // Members use the panel, but cannot manage users, invitations or Pi-hole settings.
        Assert.That((await guest.GetAsync("/api/files")).StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await guest.GetAsync("/api/users")).StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That((await guest.GetAsync("/api/invitations")).StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That((await guest.GetAsync("/api/settings/pihole")).StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task RemovedUser_IsSignedOutOnTheNextRequest()
    {
        using var admin = await _factory.CreateAuthenticatedClientAsync();
        string token = await CreateInviteAsync(admin, "Member");

        using var member = _factory.CreateClient();
        (await member.PostAsJsonAsync($"/api/invite/{token}/accept", new { username = "temporary", password = _memberPassword }))
            .EnsureSuccessStatusCode();

        var users = await admin.GetFromJsonAsync<JsonElement>("/api/users");
        int id = users.EnumerateArray().Single(user => user.GetProperty("username").GetString() == "temporary").GetProperty("id").GetInt32();

        var remove = await admin.DeleteAsync($"/api/users/{id}");
        var afterRemoval = await member.GetAsync("/api/files");

        Assert.That(remove.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(afterRemoval.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task PromotedMember_GetsAdminAccessWithoutSigningInAgain()
    {
        using var admin = await _factory.CreateAuthenticatedClientAsync();
        string token = await CreateInviteAsync(admin, "Member");

        using var member = _factory.CreateClient();
        (await member.PostAsJsonAsync($"/api/invite/{token}/accept", new { username = "promoted", password = _memberPassword }))
            .EnsureSuccessStatusCode();

        var users = await admin.GetFromJsonAsync<JsonElement>("/api/users");
        int id = users.EnumerateArray().Single(user => user.GetProperty("username").GetString() == "promoted").GetProperty("id").GetInt32();

        var before = await member.GetAsync("/api/users");
        var missingRole = await admin.PutAsJsonAsync($"/api/users/{id}/role", new { });
        var promote = await admin.PutAsJsonAsync($"/api/users/{id}/role", new { role = "Admin" });
        var after = await member.GetAsync("/api/users");

        Assert.That(before.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(missingRole.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(promote.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(after.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task RevokedLink_StopsWorking_AndAdminCannotRemoveThemselves()
    {
        using var admin = await _factory.CreateAuthenticatedClientAsync();
        var created = await (await admin.PostAsJsonAsync("/api/invitations", new { role = "Member", validForHours = 1 }))
            .Content.ReadFromJsonAsync<JsonElement>();

        var revoke = await admin.DeleteAsync($"/api/invitations/{created.GetProperty("id").GetInt32()}");
        var preview = await _factory.CreateClient().GetAsync($"/api/invite/{created.GetProperty("token").GetString()}");

        var me = (await admin.GetFromJsonAsync<JsonElement>("/api/users")).EnumerateArray()
            .Single(user => user.GetProperty("username").GetString() == NodePilotApiFactory.Username);
        var removeSelf = await admin.DeleteAsync($"/api/users/{me.GetProperty("id").GetInt32()}");

        Assert.That(revoke.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(preview.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(removeSelf.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
    }

    [TestCase("/api/users")]
    [TestCase("/api/invitations")]
    public async Task AdminEndpoints_RequireSignIn(string url)
    {
        var response = await _factory.CreateClient().GetAsync(url);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    private static async Task<string> CreateInviteAsync(HttpClient admin, string role)
    {
        var response = await admin.PostAsJsonAsync("/api/invitations", new { role, validForHours = 24 });
        response.EnsureSuccessStatusCode();

        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        return created.GetProperty("token").GetString()!;
    }
}
