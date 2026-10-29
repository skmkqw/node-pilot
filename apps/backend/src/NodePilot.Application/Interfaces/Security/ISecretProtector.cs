namespace NodePilot.Application.Interfaces.Security;

/// <summary>
/// Encrypts secrets (e.g. the Pi-hole app password) before they are written to the database.
/// </summary>
public interface ISecretProtector
{
    string Protect(string plaintext);

    /// <summary>Returns <c>null</c> when the value cannot be decrypted (e.g. the key was lost).</summary>
    string? Unprotect(string protectedValue);
}
