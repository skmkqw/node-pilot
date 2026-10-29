using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using NodePilot.Application.Interfaces.Security;

namespace NodePilot.Infrastructure.Security;

/// <summary>
/// Encrypts secrets with ASP.NET Core Data Protection (AES-256-CBC + HMAC-SHA256).
/// The key ring is stored next to the database, so a copied database alone does not
/// reveal the secrets.
/// </summary>
public sealed class DataProtectionSecretProtector(IDataProtectionProvider provider) : ISecretProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("NodePilot.Secrets.v1");

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string? Unprotect(string protectedValue)
    {
        try
        {
            return _protector.Unprotect(protectedValue);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
