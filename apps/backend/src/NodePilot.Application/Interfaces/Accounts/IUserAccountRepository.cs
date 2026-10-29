using NodePilot.Application.Accounts.Models;

namespace NodePilot.Application.Interfaces.Accounts;

public interface IUserAccountRepository
{
    Task<bool> AnyAsync(CancellationToken ct = default);

    Task<UserAccount?> GetByIdAsync(int id, CancellationToken ct = default);

    Task<UserAccount?> GetByUsernameAsync(string username, CancellationToken ct = default);

    Task AddAsync(UserAccount account, CancellationToken ct = default);
}
