using Microsoft.AspNetCore.StaticFiles;

namespace NodePilot.Api.Files;

public static class ContentTypeExtensions
{
    public const string FallbackContentType = "application/octet-stream";

    /// <summary>
    /// Registers a MIME type provider with a few media types that the ASP.NET Core
    /// defaults are missing, so browsers receive accurate types for streaming.
    /// </summary>
    public static IServiceCollection AddContentTypes(this IServiceCollection services)
    {
        var provider = new FileExtensionContentTypeProvider();

        provider.Mappings[".mkv"] = "video/x-matroska";
        provider.Mappings[".m4v"] = "video/mp4";
        provider.Mappings[".mov"] = "video/quicktime";
        provider.Mappings[".ogv"] = "video/ogg";
        provider.Mappings[".opus"] = "audio/ogg";
        provider.Mappings[".flac"] = "audio/flac";
        provider.Mappings[".m4a"] = "audio/mp4";
        provider.Mappings[".avif"] = "image/avif";

        services.AddSingleton<IContentTypeProvider>(provider);

        return services;
    }
}
