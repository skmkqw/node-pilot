using ErrorOr;
using NodePilot.Application.Common;

namespace NodePilot.Application.AdBlocking.Errors;

public static class AdBlockerErrors
{
    public static Error NotConfigured => Error.Validation(
        code: "AdBlocker.NotConfigured",
        description: "Pi-hole is not configured.");

    public static Error InvalidDuration => Error.Validation(
        code: "AdBlocker.InvalidDuration",
        description: "The duration must be between 1 second and 24 hours.");

    public static Error Unreachable(string message) => Error.Custom(
        type: CustomErrorTypes.Upstream,
        code: "AdBlocker.Unreachable",
        description: message);
}
