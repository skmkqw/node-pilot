namespace NodePilot.Application.Accounts.Models;

public sealed record UserSummary(int Id, string Username, UserRole Role, DateTime CreatedAtUtc);

public sealed record InvitationSummary(int Id, UserRole Role, string CreatedBy, DateTime CreatedAtUtc, DateTime ExpiresAtUtc);

/// <summary>Returned once, right after creation: the only time the plain token exists.</summary>
public sealed record CreatedInvitation(int Id, string Token, UserRole Role, DateTime ExpiresAtUtc);

/// <summary>What the person opening an invitation link is shown before creating an account.</summary>
public sealed record InvitationPreview(UserRole Role, string InvitedBy, DateTime ExpiresAtUtc);
