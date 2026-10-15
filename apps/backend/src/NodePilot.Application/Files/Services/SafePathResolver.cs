using ErrorOr;
using NodePilot.Application.Files.Errors;

namespace NodePilot.Application.Files.Services;

/// <summary>
/// Maps client-supplied relative paths onto the file system while guaranteeing that the
/// result stays inside the configured root (protection against path traversal).
/// </summary>
public static class SafePathResolver
{
    private const int _maxNameLength = 255;

    public static string NormalizeRoot(string rootPath)
    {
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(rootPath));
    }

    public static ErrorOr<string> Resolve(string normalizedRoot, string? relativePath)
    {
        string relative = (relativePath ?? string.Empty).Replace('\\', '/').Trim();

        if (relative.Contains('\0'))
        {
            return FileErrors.InvalidPath;
        }

        // Path.Combine would discard the root for an absolute second argument.
        relative = relative.TrimStart('/');

        string fullPath = Path.TrimEndingDirectorySeparator(
            Path.GetFullPath(Path.Combine(normalizedRoot, relative)));

        return IsWithinRoot(normalizedRoot, fullPath)
            ? fullPath
            : FileErrors.OutsideRoot;
    }

    public static bool IsWithinRoot(string normalizedRoot, string fullPath)
    {
        if (string.Equals(fullPath, normalizedRoot, StringComparison.Ordinal))
        {
            return true;
        }

        string prefix = normalizedRoot.EndsWith(Path.DirectorySeparatorChar)
            ? normalizedRoot
            : normalizedRoot + Path.DirectorySeparatorChar;

        return fullPath.StartsWith(prefix, StringComparison.Ordinal);
    }

    /// <summary>Converts an absolute path inside the root to the '/'-prefixed client form.</summary>
    public static string ToRelative(string normalizedRoot, string fullPath)
    {
        string relative = Path.GetRelativePath(normalizedRoot, fullPath);

        return relative == "."
            ? "/"
            : "/" + relative.Replace(Path.DirectorySeparatorChar, '/');
    }

    /// <summary>
    /// Validates a single file or directory name for create/upload operations.
    /// Hidden (dot-prefixed) names are rejected because listings do not show them.
    /// </summary>
    public static bool IsValidName(string? name)
    {
        return !string.IsNullOrWhiteSpace(name)
            && name.Length <= _maxNameLength
            && name == name.Trim()
            && !name.StartsWith('.')
            && name.IndexOfAny(['/', '\\', '\0']) < 0
            && name.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
    }
}
