namespace NodePilot.Application.Common;

/// <summary>
/// Error types beyond the built-in <see cref="ErrorOr.ErrorType"/> values,
/// used with <c>Error.Custom</c>.
/// </summary>
public static class CustomErrorTypes
{
    /// <summary>An external service that NodePilot depends on failed or could not be reached.</summary>
    public const int Upstream = 100;
}
