using ErrorOr;
using NodePilot.Application.Files.Models;

namespace NodePilot.Application.Interfaces.Files;

public interface IFileManagerService
{
    ErrorOr<DirectoryListing> List(string? path);

    ErrorOr<ResolvedFile> GetFile(string? path);

    ErrorOr<Deleted> Delete(string? path);

    ErrorOr<FileEntry> CreateDirectory(string? parentPath, string? name);

    Task<ErrorOr<FileEntry>> SaveAsync(
        string? directoryPath,
        string? fileName,
        Stream content,
        CancellationToken ct = default);
}
