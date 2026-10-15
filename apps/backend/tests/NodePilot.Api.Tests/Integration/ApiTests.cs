using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace NodePilot.Api.Tests.Integration;

[TestFixture]
[NonParallelizable]
public class ApiTests
{
    private NodePilotApiFactory _factory = null!;
    private HttpClient _authenticated = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        _factory = new NodePilotApiFactory();
        _authenticated = await _factory.CreateAuthenticatedClientAsync();
    }

    [OneTimeTearDown]
    public void OneTimeTearDown()
    {
        _authenticated.Dispose();
        _factory.Dispose();
    }

    [Test]
    public async Task Health_IsPublic()
    {
        var response = await _factory.CreateClient().GetAsync("/health");

        Assert.That(response.StatusCode, Is.Not.EqualTo(HttpStatusCode.Unauthorized));
    }

    [TestCase("/api/auth/me")]
    [TestCase("/api/system/overview")]
    [TestCase("/api/system/metrics/current")]
    [TestCase("/api/files")]
    [TestCase("/api/files/content?path=/a.txt")]
    [TestCase("/api/adblock")]
    public async Task ProtectedEndpoints_WithoutSession_Return401(string url)
    {
        var response = await _factory.CreateClient().GetAsync(url);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Login_WithWrongPassword_Returns401AndNoCookie()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/login",
            new { username = NodePilotApiFactory.Username, password = "wrong-password" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(response.Headers.Contains("Set-Cookie"), Is.False);
    }

    [Test]
    public async Task Me_AfterLogin_ReturnsUsername()
    {
        var me = await _authenticated.GetFromJsonAsync<JsonElement>("/api/auth/me");

        Assert.That(me.GetProperty("username").GetString(), Is.EqualTo(NodePilotApiFactory.Username));
    }

    [Test]
    public async Task Logout_InvalidatesSession()
    {
        using var client = await _factory.CreateAuthenticatedClientAsync();

        await client.PostAsync("/api/auth/logout", null);
        var response = await client.GetAsync("/api/auth/me");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Overview_ReturnsHostInformation()
    {
        var overview = await _authenticated.GetFromJsonAsync<JsonElement>("/api/system/overview");

        Assert.That(overview.GetProperty("processorCount").GetInt32(), Is.GreaterThan(0));
        Assert.That(overview.GetProperty("hostname").GetString(), Is.Not.Empty);
    }

    [Test]
    public async Task Files_UploadListStreamDelete_RoundTrip()
    {
        byte[] payload = Enumerable.Range(0, 4096).Select(index => (byte)(index % 256)).ToArray();

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(payload);
        file.Headers.ContentType = new MediaTypeHeaderValue("video/mp4");
        form.Add(file, "files", "clip.mp4");

        var upload = await _authenticated.PostAsync("/api/files/upload?path=/", form);
        Assert.That(upload.StatusCode, Is.EqualTo(HttpStatusCode.Created));

        var listing = await _authenticated.GetFromJsonAsync<JsonElement>("/api/files?path=/");
        var entry = listing.GetProperty("entries").EnumerateArray().Single(item => item.GetProperty("name").GetString() == "clip.mp4");
        Assert.That(entry.GetProperty("isPlayable").GetBoolean(), Is.True);
        Assert.That(entry.GetProperty("kind").GetString(), Is.EqualTo("Video"));

        // A ranged request is what the browser's <video> element sends when seeking.
        using var rangeRequest = new HttpRequestMessage(HttpMethod.Get, "/api/files/content?path=/clip.mp4");
        rangeRequest.Headers.Range = new RangeHeaderValue(100, 199);
        var partial = await _authenticated.SendAsync(rangeRequest);

        Assert.That(partial.StatusCode, Is.EqualTo(HttpStatusCode.PartialContent));
        Assert.That(partial.Content.Headers.ContentType?.MediaType, Is.EqualTo("video/mp4"));
        Assert.That(partial.Content.Headers.ContentRange?.ToString(), Is.EqualTo("bytes 100-199/4096"));
        Assert.That(await partial.Content.ReadAsByteArrayAsync(), Is.EqualTo(payload[100..200]));

        var delete = await _authenticated.DeleteAsync("/api/files?path=/clip.mp4");
        Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(File.Exists(Path.Combine(_factory.FilesRoot, "clip.mp4")), Is.False);
    }

    [TestCase("/api/files?path=../")]
    [TestCase("/api/files?path=/../../etc")]
    [TestCase("/api/files/content?path=../../etc/passwd")]
    public async Task Files_PathTraversal_Returns403(string url)
    {
        var response = await _authenticated.GetAsync(url);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task Files_DeleteRoot_Returns403()
    {
        var response = await _authenticated.DeleteAsync("/api/files?path=/");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task Files_CreateDirectoryTwice_ReturnsConflict()
    {
        var first = await _authenticated.PostAsJsonAsync("/api/files/directories", new { path = "/", name = "Movies" });
        var second = await _authenticated.PostAsJsonAsync("/api/files/directories", new { path = "/", name = "Movies" });

        Assert.That(first.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(second.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
    }

    [Test]
    public async Task AdBlock_NotConfigured_ReportsStatusAndRejectsToggle()
    {
        var status = await _authenticated.GetFromJsonAsync<JsonElement>("/api/adblock");
        Assert.That(status.GetProperty("configured").GetBoolean(), Is.False);

        var toggle = await _authenticated.PostAsJsonAsync("/api/adblock/blocking", new { enabled = false });
        Assert.That(toggle.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
    }
}
