using ErrorOr;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using NodePilot.Api.Files;
using NodePilot.Application.Files.Models;
using NodePilot.Application.Interfaces.Files;

namespace NodePilot.Api.Controllers;

[Route("api/files")]
public class FilesController : BaseController
{
    private readonly IFileManagerService _fileManager;

    private readonly IContentTypeProvider _contentTypes;

    public FilesController(IFileManagerService fileManager, IContentTypeProvider contentTypes)
    {
        _fileManager = fileManager;
        _contentTypes = contentTypes;
    }

    [HttpGet]
    public IActionResult List([FromQuery] string? path)
    {
        return _fileManager.List(path).Match(onValue: Ok, onError: Problem);
    }

    /// <summary>
    /// Streams a file. Range requests are honoured (206 Partial Content), which lets the
    /// browser's video player seek without downloading the whole file first.
    /// </summary>
    [HttpGet("content")]
    public IActionResult GetContent([FromQuery] string? path, [FromQuery] bool download = false)
    {
        var result = _fileManager.GetFile(path);

        if (result.IsError)
        {
            return Problem(result.Errors);
        }

        var file = result.Value;

        if (!_contentTypes.TryGetContentType(file.Name, out string? contentType))
        {
            contentType = ContentTypeExtensions.FallbackContentType;
        }

        return download
            ? PhysicalFile(file.FullPath, contentType, file.Name, enableRangeProcessing: true)
            : PhysicalFile(file.FullPath, contentType, enableRangeProcessing: true);
    }

    [HttpPost("directories")]
    public IActionResult CreateDirectory([FromBody] CreateDirectoryRequest request)
    {
        return _fileManager
            .CreateDirectory(request.Path, request.Name)
            .Match(entry => StatusCode(StatusCodes.Status201Created, entry), Problem);
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadAsync([FromQuery] string? path, CancellationToken ct)
    {
        if (!Request.HasFormContentType)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Expected multipart/form-data.");
        }

        var form = await Request.ReadFormAsync(ct);

        if (form.Files.Count == 0)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "No files were uploaded.");
        }

        var created = new List<FileEntry>();

        foreach (var file in form.Files)
        {
            await using var stream = file.OpenReadStream();

            ErrorOr<FileEntry> result = await _fileManager.SaveAsync(path, file.FileName, stream, ct);

            if (result.IsError)
            {
                return Problem(result.Errors);
            }

            created.Add(result.Value);
        }

        return StatusCode(StatusCodes.Status201Created, created);
    }

    [HttpDelete]
    public IActionResult Delete([FromQuery] string? path)
    {
        return _fileManager.Delete(path).Match(_ => NoContent(), Problem);
    }
}

public sealed record CreateDirectoryRequest(string? Path, string? Name);
