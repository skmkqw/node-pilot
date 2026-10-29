using ErrorOr;

namespace NodePilot.Application.Accounts.Errors;

public static class InvitationErrors
{
    // One error for unknown, expired, used and revoked links: the response does not reveal
    // whether a guessed token ever existed.
    public static Error InvalidOrExpired => Error.NotFound(
        code: "Invitations.InvalidOrExpired",
        description: "This invite link is invalid, has expired or was already used.");

    public static Error NotFound => Error.NotFound(
        code: "Invitations.NotFound",
        description: "The invitation no longer exists.");

    public static Error InvalidLifetime => Error.Validation(
        code: "Invitations.InvalidLifetime",
        description: "An invite link must be valid for 1 to 168 hours.");
}
