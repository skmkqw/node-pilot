using ErrorOr;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NodePilot.Application.Files.Errors;
using NodePilot.Application.Files.Models;
using NodePilot.Application.Files.Settings;
using NodePilot.Application.Interfaces.Files;

namespace NodePilot.Application.Files.Services;

public sealed class FileManagerService : IFileManagerService
{
    private static readonly EnumerationOptions _listingOptions = new()
    {
        IgnoreInaccessible = true,
        AttributesToSkip = FileAttributes.Hidden | FileAttributes.System,
        RecurseSubdirectories = false,
    };

    private readonly string _root;
    private readonly ILogger<FileManagerService> _logger;

    public FileManagerService(
        IOptions<FileManagerSettings> settings,
        ILogger<FileManagerService> logger)
    {
        _root = SafePathResolver.NormalizeRoot(settings.Value.RootPath);
        _logger = logger;

        Directory.CreateDirectory(_root);
    }

    public ErrorOr<DirectoryListing> List(string? path)
    {
        var resolved = ResolveInsideRoot(path);

        if (resolved.IsError)
        {
            return resolved.Errors;
        }

        string fullPath = resolved.Value;

        if (!Directory.Exists(fullPath))
        {
            return File.Exists(fullPath) ? FileErrors.NotADirectory : FileErrors.NotFound;
        }

        try
        {
            var entries = new DirectoryInfo(fullPath)
                .EnumerateFileSystemInfos("*", _listingOptions)
                .Where(info => SafePathResolver.IsWithinRoot(_root, ResolveLinkTarget(info)))
                .Select(ToEntry)
                .OrderBy(entry => entry.Kind != FileKind.Directory)
                .ThenBy(entry => entry.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            string relative = SafePathResolver.ToRelative(_root, fullPath);
            string? parent = fullPath == _root
                ? null
                : SafePathResolver.ToRelative(_root, Path.GetDirectoryName(fullPath)!);

            return new DirectoryListing(
                Path: relative,
                ParentPath: parent,
                Entries: entries,
                DirectoryCount: entries.Count(entry => entry.Kind == FileKind.Directory),
                FileCount: entries.Count(entry => entry.Kind != FileKind.Directory),
                TotalSizeBytes: entries.Sum(entry => entry.SizeBytes ?? 0));
        }
        catch (UnauthorizedAccessException)
        {
            return FileErrors.AccessDenied;
        }
    }

    public ErrorOr<ResolvedFile> GetFile(string? path)
    {
        var resolved = ResolveInsideRoot(path);

        if (resolved.IsError)
        {
            return resolved.Errors;
        }

        var file = new FileInfo(resolved.Value);

        if (!file.Exists)
        {
            return Directory.Exists(file.FullName) ? FileErrors.NotAFile : FileErrors.NotFound;
        }

        return new ResolvedFile(file.FullName, file.Name, FileKindDetector.Detect(file.Name), file.Length);
    }

    public ErrorOr<Deleted> Delete(string? path)
    {
        var resolved = ResolveInsideRoot(path);

        if (resolved.IsError)
        {
            return resolved.Errors;
        }

        string fullPath = resolved.Value;

        if (fullPath == _root)
        {
            return FileErrors.RootDeletionForbidden;
        }

        try
        {
            FileSystemInfo? info = Directory.Exists(fullPath)
                ? new DirectoryInfo(fullPath)
                : File.Exists(fullPath) ? new FileInfo(fullPath) : null;

            switch (info)
            {
                case null:
                    return FileErrors.NotFound;

                // Never follow links when deleting: remove the link itself, not its target.
                case { LinkTarget: not null }:
                    info.Delete();
                    break;

                case DirectoryInfo directory:
                    directory.Delete(recursive: true);
                    break;

                default:
                    info.Delete();
                    break;
            }

            _logger.LogInformation("Deleted {Path}.", SafePathResolver.ToRelative(_root, fullPath));

            return Result.Deleted;
        }
        catch (UnauthorizedAccessException)
        {
            return FileErrors.AccessDenied;
        }
        catch (IOException ex)
        {
            return FileErrors.IoFailure(ex.Message);
        }
    }

    public ErrorOr<FileEntry> CreateDirectory(string? parentPath, string? name)
    {
        var target = ResolveNewEntry(parentPath, name);

        if (target.IsError)
        {
            return target.Errors;
        }

        try
        {
            var directory = Directory.CreateDirectory(target.Value);

            return ToEntry(directory);
        }
        catch (UnauthorizedAccessException)
        {
            return FileErrors.AccessDenied;
        }
        catch (IOException ex)
        {
            return FileErrors.IoFailure(ex.Message);
        }
    }

    public async Task<ErrorOr<FileEntry>> SaveAsync(
        string? directoryPath,
        string? fileName,
        Stream content,
        CancellationToken ct = default)
    {
        var target = ResolveNewEntry(directoryPath, fileName);

        if (target.IsError)
        {
            return target.Errors;
        }

        string fullPath = target.Value;

        try
        {
            await using (var output = new FileStream(
                fullPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true))
            {
                await content.CopyToAsync(output, ct);
            }

            return ToEntry(new FileInfo(fullPath));
        }
        catch (Exception ex) when (ex is IOException or OperationCanceledException or UnauthorizedAccessException)
        {
            TryDeletePartialFile(fullPath);

            return ex switch
            {
                UnauthorizedAccessException => FileErrors.AccessDenied,
                OperationCanceledException => FileErrors.IoFailure("The upload was cancelled."),
                _ => FileErrors.IoFailure(ex.Message),
            };
        }
    }

    private ErrorOr<string> ResolveInsideRoot(string? path)
    {
        var resolved = SafePathResolver.Resolve(_root, path);

        if (resolved.IsError)
        {
            return resolved.Errors;
        }

        // A symlink inside the root could point anywhere; only follow it if its target
        // also lies inside the root.
        FileSystemInfo info = Directory.Exists(resolved.Value)
            ? new DirectoryInfo(resolved.Value)
            : new FileInfo(resolved.Value);

        return SafePathResolver.IsWithinRoot(_root, ResolveLinkTarget(info))
            ? resolved.Value
            : FileErrors.OutsideRoot;
    }

    private ErrorOr<string> ResolveNewEntry(string? parentPath, string? name)
    {
        if (!SafePathResolver.IsValidName(name))
        {
            return FileErrors.InvalidName;
        }

        var parent = ResolveInsideRoot(parentPath);

        if (parent.IsError)
        {
            return parent.Errors;
        }

        if (!Directory.Exists(parent.Value))
        {
            return FileErrors.NotFound;
        }

        string fullPath = Path.Combine(parent.Value, name!);

        if (!SafePathResolver.IsWithinRoot(_root, fullPath))
        {
            return FileErrors.OutsideRoot;
        }

        if (File.Exists(fullPath) || Directory.Exists(fullPath))
        {
            return FileErrors.AlreadyExists;
        }

        return fullPath;
    }

    private static string ResolveLinkTarget(FileSystemInfo info)
    {
        try
        {
            return info.LinkTarget is null
                ? info.FullName
                : info.ResolveLinkTarget(returnFinalTarget: true)?.FullName ?? info.FullName;
        }
        catch (IOException)
        {
            // Broken or cyclic link: treat it as pointing to itself so it is still listed.
            return info.FullName;
        }
    }

    private FileEntry ToEntry(FileSystemInfo info)
    {
        bool isDirectory = info is DirectoryInfo;

        return new FileEntry(
            Name: info.Name,
            Path: SafePathResolver.ToRelative(_root, info.FullName),
            Kind: isDirectory ? FileKind.Directory : FileKindDetector.Detect(info.Name),
            SizeBytes: info is FileInfo file ? file.Length : null,
            ModifiedAtUtc: info.LastWriteTimeUtc,
            IsPlayable: !isDirectory && FileKindDetector.IsPlayable(info.Name));
    }

    private void TryDeletePartialFile(string fullPath)
    {
        try
        {
            File.Delete(fullPath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(ex, "Unable to remove partial upload {Path}.", fullPath);
        }
    }
}
