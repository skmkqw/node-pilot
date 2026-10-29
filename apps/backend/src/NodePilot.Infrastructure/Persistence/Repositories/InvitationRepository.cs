using Microsoft.EntityFrameworkCore;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Interfaces.Accounts;

namespace NodePilot.Infrastructure.Persistence.Repositories;

public sealed class InvitationRepository(NodePilotDbContext dbContext) : IInvitationRepository
{
    private readonly NodePilotDbContext _dbContext = dbContext;

    public Task<Invitation?> GetByIdAsync(int id, CancellationToken ct = default) =>
        _dbContext.Invitations.FirstOrDefaultAsync(invitation => invitation.Id == id, ct);

    public Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        _dbContext.Invitations
            .Include(invitation => invitation.CreatedBy)
            .FirstOrDefaultAsync(invitation => invitation.TokenHash == tokenHash, ct);

    public async Task<IReadOnlyList<Invitation>> ListPendingAsync(DateTime nowUtc, CancellationToken ct = default) =>
        await _dbContext.Invitations
            .AsNoTracking()
            .Include(invitation => invitation.CreatedBy)
            .Where(invitation => invitation.AcceptedAtUtc == null && invitation.ExpiresAtUtc > nowUtc)
            .OrderByDescending(invitation => invitation.CreatedAtUtc)
            .ToListAsync(ct);

    public async Task AddAsync(Invitation invitation, CancellationToken ct = default) =>
        await _dbContext.Invitations.AddAsync(invitation, ct);

    public void Remove(Invitation invitation) =>
        _dbContext.Invitations.Remove(invitation);

    public Task RemoveExpiredAsync(DateTime nowUtc, CancellationToken ct = default) =>
        _dbContext.Invitations
            .Where(invitation => invitation.AcceptedAtUtc == null && invitation.ExpiresAtUtc <= nowUtc)
            .ExecuteDeleteAsync(ct);
}
