using Microsoft.EntityFrameworkCore;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;

namespace NodePilot.Infrastructure.Persistence.Repositories;

public sealed class UserAccountRepository(NodePilotDbContext dbContext) : IUserAccountRepository
{
    private readonly NodePilotDbContext _dbContext = dbContext;

    public Task<bool> AnyAsync(CancellationToken ct = default) =>
        _dbContext.Users.AnyAsync(ct);

    public Task<UserAccount?> GetByIdAsync(int id, CancellationToken ct = default) =>
        _dbContext.Users.FirstOrDefaultAsync(user => user.Id == id, ct);

    // The username column uses NOCASE collation, so this comparison ignores case.
    public Task<UserAccount?> GetByUsernameAsync(string username, CancellationToken ct = default) =>
        _dbContext.Users.FirstOrDefaultAsync(user => user.Username == username, ct);

    public async Task<IReadOnlyList<UserAccount>> ListAsync(CancellationToken ct = default) =>
        await _dbContext.Users.OrderBy(user => user.CreatedAtUtc).ToListAsync(ct);

    public async Task AddAsync(UserAccount account, CancellationToken ct = default) =>
        await _dbContext.Users.AddAsync(account, ct);

    public void Remove(UserAccount account) =>
        _dbContext.Users.Remove(account);
}
