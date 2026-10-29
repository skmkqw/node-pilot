using Microsoft.AspNetCore.Identity;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Security;
using IdentityResult = Microsoft.AspNetCore.Identity.PasswordVerificationResult;

namespace NodePilot.Infrastructure.Security;

/// <summary>
/// Uses the ASP.NET Core Identity hasher: PBKDF2 with HMAC-SHA512, a random 128-bit salt
/// per password and 100 000 iterations (format version 3). The format is self-describing,
/// so stronger parameters in future versions are detected via <c>SuccessRehashNeeded</c>.
/// </summary>
public sealed class IdentityPasswordHasher : IPasswordHasher
{
    private static readonly UserAccount _user = new();

    private readonly PasswordHasher<UserAccount> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(_user, password);

    public PasswordVerification Verify(string hash, string password)
    {
        try
        {
            return _hasher.VerifyHashedPassword(_user, hash, password) switch
            {
                IdentityResult.Success => PasswordVerification.Success,
                IdentityResult.SuccessRehashNeeded => PasswordVerification.SuccessRehashNeeded,
                _ => PasswordVerification.Failed,
            };
        }
        catch (FormatException)
        {
            return PasswordVerification.Failed;
        }
    }
}
