namespace NodePilot.Application.Files.Settings;

public sealed class FileManagerSettings
{
    public const string SectionName = "FileManager";

    /// <summary>
    /// The only directory the file manager may access. Relative paths are resolved against
    /// the working directory of the backend process.
    /// </summary>
    public string RootPath { get; init; } = string.Empty;

    public int MaxUploadMegabytes { get; init; }
}
