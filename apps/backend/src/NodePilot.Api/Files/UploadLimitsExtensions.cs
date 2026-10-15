using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Options;
using NodePilot.Application.Files.Settings;

namespace NodePilot.Api.Files;

public static class UploadLimitsExtensions
{
    /// <summary>
    /// Raises the default 30 MB request body and 128 MB multipart limits to the configured
    /// maximum upload size, so that videos can be uploaded through the file manager.
    /// </summary>
    public static IServiceCollection AddUploadLimits(this IServiceCollection services)
    {
        services
            .AddOptions<KestrelServerOptions>()
            .Configure<IOptions<FileManagerSettings>>((options, fileManager) =>
                options.Limits.MaxRequestBodySize = ToBytes(fileManager.Value.MaxUploadMegabytes));

        services
            .AddOptions<FormOptions>()
            .Configure<IOptions<FileManagerSettings>>((options, fileManager) =>
                options.MultipartBodyLengthLimit = ToBytes(fileManager.Value.MaxUploadMegabytes));

        return services;
    }

    private static long ToBytes(int megabytes) => megabytes * 1024L * 1024L;
}
