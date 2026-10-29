using ErrorOr;

namespace NodePilot.Application.Accounts.Errors;

public static class AccountErrors
{
    public static Error SetupAlreadyCompleted => Error.Conflict(
        code: "Accounts.SetupAlreadyCompleted",
        description: "The administrator account has already been created.");

    public static Error InvalidCredentials => Error.Unauthorized(
        code: "Accounts.InvalidCredentials",
        description: "Invalid username or password.");

    public static Error InvalidUsername => Error.Validation(
        code: "Accounts.InvalidUsername",
        description: "The username must be 3–32 characters: letters, digits, '.', '_' or '-'.");

    public static Error WeakPassword => Error.Validation(
        code: "Accounts.WeakPassword",
        description: "The password must be between 8 and 128 characters long.");

    public static Error CurrentPasswordIncorrect => Error.Validation(
        code: "Accounts.CurrentPasswordIncorrect",
        description: "The current password is incorrect.");

    public static Error NotFound => Error.NotFound(
        code: "Accounts.NotFound",
        description: "The account no longer exists.");

    public static Error UsernameTaken => Error.Conflict(
        code: "Accounts.UsernameTaken",
        description: "This username is already taken.");

    public static Error CannotModifySelf => Error.Validation(
        code: "Accounts.CannotModifySelf",
        description: "You can't remove your own account or change your own role.");

    public static Error InvalidRole => Error.Validation(
        code: "Accounts.InvalidRole",
        description: "The role must be Admin or Member.");
}
