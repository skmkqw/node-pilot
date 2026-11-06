using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace NodePilot.Api.Tests.Integration;

[TestFixture]
[NonParallelizable]
public class ReverseProxyTests
{
    private const int AttemptsPerMinute = 5;

    [Test]
    public async Task Enabled_RateLimitsEachForwardedClientSeparately()
    {
        using var factory = CreateFactory(proxyEnabled: true);
        await SetUpAdministratorAsync(factory);

        for (int i = 0; i < AttemptsPerMinute; i++)
        {
            await LoginAsync(factory, "10.0.0.1", "wrong-password");
        }

        var blocked = await LoginAsync(factory, "10.0.0.1", "wrong-password");
        var otherDevice = await LoginAsync(factory, "10.0.0.2", NodePilotApiFactory.Password);

        Assert.That(blocked.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests));
        Assert.That(otherDevice.StatusCode, Is.EqualTo(HttpStatusCode.OK), "another device has its own limit");
    }

    [Test]
    public async Task Disabled_IgnoresForwardedFor()
    {
        using var factory = CreateFactory(proxyEnabled: false);
        await SetUpAdministratorAsync(factory);

        // Setup used one attempt of the shared bucket, since the header is ignored.
        for (int i = 0; i < AttemptsPerMinute - 1; i++)
        {
            await LoginAsync(factory, "10.0.0.1", "wrong-password");
        }

        var otherDevice = await LoginAsync(factory, "10.0.0.2", NodePilotApiFactory.Password);

        Assert.That(otherDevice.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests), "a client can't choose its own IP");
    }

    [Test]
    public async Task Enabled_UnknownProxy_IsNotTrusted()
    {
        using var factory = CreateFactory(proxyEnabled: true, remoteAddress: IPAddress.Parse("192.168.1.50"));
        await SetUpAdministratorAsync(factory);

        for (int i = 0; i < AttemptsPerMinute - 1; i++)
        {
            await LoginAsync(factory, "10.0.0.1", "wrong-password");
        }

        var spoofed = await LoginAsync(factory, "10.0.0.2", NodePilotApiFactory.Password);

        Assert.That(spoofed.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests));
    }

    [TestCase("https", true)]
    [TestCase(null, false)]
    public async Task Enabled_SessionCookieIsSecure_WhenTheProxySaysHttps(string? forwardedProto, bool expectSecure)
    {
        using var factory = CreateFactory(proxyEnabled: true);

        var response = await LoginAsync(factory, "10.0.0.1", NodePilotApiFactory.Password, forwardedProto, path: "/api/auth/setup");
        string cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("nodepilot.session="));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(cookie.Contains("secure", StringComparison.OrdinalIgnoreCase), Is.EqualTo(expectSecure));
    }

    [TestCase("ReverseProxy:KnownProxies:0", "not-an-ip")]
    [TestCase("ReverseProxy:KnownNetworks:0", "10.0.0.0/99")]
    public void InvalidProxyAddress_StopsStartup(string key, string value)
    {
        using var factory = new NodePilotApiFactory(new Dictionary<string, string?>
        {
            ["ReverseProxy:Enabled"] = "true",
            [key] = value,
        });

        Assert.That(() => factory.CreateClient(), Throws.Exception);
    }

    /// <summary>
    /// TestServer leaves the remote address empty; pretend every request comes from
    /// <paramref name="remoteAddress"/> (loopback by default, i.e. nginx on the same host).
    /// </summary>
    private static WebApplicationFactory<Program> CreateFactory(bool proxyEnabled, IPAddress? remoteAddress = null)
    {
        var factory = new NodePilotApiFactory(new Dictionary<string, string?>
        {
            ["Auth:LoginAttemptsPerMinute"] = AttemptsPerMinute.ToString(),
            ["ReverseProxy:Enabled"] = proxyEnabled.ToString(),
        });

        return factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddSingleton<IStartupFilter>(new RemoteAddressStartupFilter(remoteAddress ?? IPAddress.Loopback))));
    }

    private static async Task SetUpAdministratorAsync(WebApplicationFactory<Program> factory)
    {
        var response = await LoginAsync(factory, "10.0.0.99", NodePilotApiFactory.Password, path: "/api/auth/setup");
        response.EnsureSuccessStatusCode();
    }

    private static async Task<HttpResponseMessage> LoginAsync(
        WebApplicationFactory<Program> factory,
        string forwardedFor,
        string password,
        string? forwardedProto = null,
        string path = "/api/auth/login")
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(new { username = NodePilotApiFactory.Username, password }),
        };

        request.Headers.Add("X-Forwarded-For", forwardedFor);

        if (forwardedProto is not null)
        {
            request.Headers.Add("X-Forwarded-Proto", forwardedProto);
        }

        return await client.SendAsync(request);
    }

    private sealed class RemoteAddressStartupFilter(IPAddress address) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = address;
                return nextMiddleware(context);
            });

            next(app);
        };
    }
}
