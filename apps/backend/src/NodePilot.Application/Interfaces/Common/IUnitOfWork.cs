namespace NodePilot.Application.Interfaces.Common;

public interface IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken ct = default);
}