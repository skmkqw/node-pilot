namespace NodePilot.Application.Interfaces.Security;

public enum PasswordVerification
{
    Failed,
    Success,

    /// <summary>Correct password, but the hash uses outdated parameters and should be replaced.</summary>
    SuccessRehashNeeded,
}

public interface IPasswordHasher
{
    string Hash(string password);

    PasswordVerification Verify(string hash, string password);
}
