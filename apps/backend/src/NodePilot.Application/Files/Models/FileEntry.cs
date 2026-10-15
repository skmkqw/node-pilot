namespace NodePilot.Application.Files.Models;

public enum FileKind
{
    Directory,
    Video,
    Audio,
    Image,
    Document,
    Archive,
    Code,
    Other
}

/// <param name="Path">Path relative to the file manager root, always starting with '/'.</param>
/// <param name="IsPlayable">True when browsers can play the file natively (video/audio).</param>
public sealed record FileEntry(
    string Name,
    string Path,
    FileKind Kind,
    long? SizeBytes,
    DateTime ModifiedAtUtc,
    bool IsPlayable);

public sealed record DirectoryListing(
    string Path,
    string? ParentPath,
    IReadOnlyList<FileEntry> Entries,
    int DirectoryCount,
    int FileCount,
    long TotalSizeBytes);

public sealed record ResolvedFile(string FullPath, string Name, FileKind Kind, long SizeBytes);
