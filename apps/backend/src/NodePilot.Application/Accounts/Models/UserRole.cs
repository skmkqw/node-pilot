namespace NodePilot.Application.Accounts.Models;

public enum UserRole
{
    /// <summary>Full access: users, invitations and service settings (Pi-hole).</summary>
    Admin,

    /// <summary>Household member: dashboard, files and media, ad-blocking switch.</summary>
    Member,
}
