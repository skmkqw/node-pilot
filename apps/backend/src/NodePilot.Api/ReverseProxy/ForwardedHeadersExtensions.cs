using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;

namespace NodePilot.Api.ReverseProxy;

public static class ForwardedHeadersExtensions
{
    /// <summary>
    /// Behind a reverse proxy every connection comes from the proxy and arrives over plain HTTP.
    /// With <c>ReverseProxy:Enabled</c>, the client IP and scheme are taken from the proxy's
    /// <c>X-Forwarded-*</c> headers, so the login rate limit is per device again and the
    /// session cookie is marked <c>Secure</c> when the browser uses HTTPS.
    /// </summary>
    public static IServiceCollection AddReverseProxySupport(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddOptions<ReverseProxySettings>()
            .Bind(configuration.GetSection(ReverseProxySettings.SectionName))
            .Validate(
                settings => settings.KnownProxies.All(proxy => IPAddress.TryParse(proxy, out _)),
                "ReverseProxy:KnownProxies must contain IP addresses only.")
            .Validate(
                settings => settings.KnownNetworks.All(network => System.Net.IPNetwork.TryParse(network, out _)),
                "ReverseProxy:KnownNetworks must contain networks in CIDR notation (e.g. 172.16.0.0/12).")
            .Validate(
                settings => !settings.Enabled || settings.KnownProxies.Length + settings.KnownNetworks.Length > 0,
                "ReverseProxy:Enabled requires at least one entry in KnownProxies or KnownNetworks.")
            .ValidateOnStart();

        services
            .AddOptions<ForwardedHeadersOptions>()
            .Configure<IOptions<ReverseProxySettings>>((options, proxy) =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

                // Only the last hop (our own proxy) is trusted; earlier entries could be forged by the client.
                options.ForwardLimit = 1;

                // The defaults trust loopback; replace them so only the configured proxies count.
                options.KnownProxies.Clear();
                options.KnownIPNetworks.Clear();

                foreach (string address in proxy.Value.KnownProxies)
                {
                    options.KnownProxies.Add(IPAddress.Parse(address));
                }

                foreach (string network in proxy.Value.KnownNetworks)
                {
                    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
                }
            });

        return services;
    }

    /// <summary>Must run before CORS, authentication and rate limiting, which all read the client address or scheme.</summary>
    public static WebApplication UseReverseProxySupport(this WebApplication app)
    {
        if (app.Services.GetRequiredService<IOptions<ReverseProxySettings>>().Value.Enabled)
        {
            app.UseForwardedHeaders();
        }

        return app;
    }
}
