using ErrorOr;
using Microsoft.AspNetCore.Mvc;
using NodePilot.Application.Files.Models;
using NodePilot.Application.Interfaces.Files;

namespace NodePilot.Api.Controllers;

[Route("api/files")]
public class FilesController : BaseController
{
    private readonly IFileManagerService _fileManager;

    public FilesController(IFileManagerService fileManager)
    {
        _fileManager = fileManager;
    }

    [HttpGet]
    public IActionResult List([FromQuery] string? path)
    {
        return _fileManager.List(path).Match(onValue: Ok, onError: Problem);
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
