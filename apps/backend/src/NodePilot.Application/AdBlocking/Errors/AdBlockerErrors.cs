using ErrorOr;
using NodePilot.Application.Common;

namespace NodePilot.Application.AdBlocking.Errors;

public static class AdBlockerErrors
{
    public static Error NotConfigured => Error.Validation(
        code: "AdBlocker.NotConfigured",
        description: "Pi-hole is not configured.");

    public static Error InvalidUrl => Error.Validation(
        code: "AdBlocker.InvalidUrl",
        description: "Enter the Pi-hole address as an http(s) URL, e.g. http://192.168.1.2.");

    public static Error InvalidDuration => Error.Validation(
        code: "AdBlocker.InvalidDuration",
        description: "The duration must be between 1 second and 24 hours.");

    public static Error Unreachable(string message) => Error.Custom(
        type: CustomErrorTypes.Upstream,
        code: "AdBlocker.Unreachable",
        description: message);
}
