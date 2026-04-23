using Microsoft.EntityFrameworkCore;
using NodePilot.Application.Interfaces.SystemStatus;
using NodePilot.Application.SystemStatus;

namespace NodePilot.Infrastructure.Persistence.Repositories;

public sealed class SystemMetricsRepository : ISystemMetricsRepository
{
    private readonly NodePilotDbContext _dbContext;

    public SystemMetricsRepository(NodePilotDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<SystemMetric?> GetLatestSuccessfulAsync(CancellationToken ct = default)
    {
        return await _dbContext.SystemMetrics
            .AsNoTracking()
            .Where(m => m.Status == MetricCollectionStatus.Success)
            .OrderByDescending(m => m.CollectedAtUtc)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<List<SystemMetric>> GetHistoricalAsync(
        DateTime start,
        DateTime end,
        CancellationToken ct = default)
    {
        return await _dbContext.SystemMetrics
            .AsNoTracking()
            .Where(m =>
                m.CollectedAtUtc >= start &&
                m.CollectedAtUtc <= end)
            .OrderBy(m => m.CollectedAtUtc)
            .ToListAsync(ct);
    }

    public async Task SaveAsync(SystemMetric systemMetric, CancellationToken ct = default)
    {
        await _dbContext.SystemMetrics.AddAsync(systemMetric, ct);
    }
}