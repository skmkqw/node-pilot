using ErrorOr;

namespace NodePilot.Application.Files.Errors;

public static class FileErrors
{
    public static Error InvalidPath => Error.Validation(
        code: "Files.InvalidPath",
        description: "The path is not valid.");

    public static Error OutsideRoot => Error.Forbidden(
        code: "Files.OutsideRoot",
        description: "The path points outside of the file manager root.");

    public static Error NotFound => Error.NotFound(
        code: "Files.NotFound",
        description: "The file or directory does not exist.");

    public static Error NotADirectory => Error.Validation(
        code: "Files.NotADirectory",
        description: "The path does not point to a directory.");

    public static Error NotAFile => Error.Validation(
        code: "Files.NotAFile",
        description: "The path does not point to a file.");

    public static Error InvalidName => Error.Validation(
        code: "Files.InvalidName",
        description: "The name is empty, too long, hidden or contains path separators.");

    public static Error AlreadyExists => Error.Conflict(
        code: "Files.AlreadyExists",
        description: "A file or directory with this name already exists.");

    public static Error RootDeletionForbidden => Error.Forbidden(
        code: "Files.RootDeletionForbidden",
        description: "The root directory cannot be deleted.");

    public static Error AccessDenied => Error.Forbidden(
        code: "Files.AccessDenied",
        description: "The server process has no permission to access this path.");

    public static Error IoFailure(string message) => Error.Failure(
        code: "Files.IoFailure",
        description: message);
}
