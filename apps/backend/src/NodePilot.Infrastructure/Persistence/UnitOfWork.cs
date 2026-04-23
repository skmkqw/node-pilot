using NodePilot.Application.Interfaces.Common;

namespace NodePilot.Infrastructure.Persistence;

public class UnitOfWork : IUnitOfWork
{
    private readonly NodePilotDbContext _dbContext;

    public UnitOfWork(NodePilotDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _dbContext.SaveChangesAsync(ct);
    }
}