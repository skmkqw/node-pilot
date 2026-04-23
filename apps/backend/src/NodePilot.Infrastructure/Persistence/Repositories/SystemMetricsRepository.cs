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

    public async Task SaveAsync(SystemMetric systemMetric, CancellationToken ct = default)
    {
        await _dbContext.SystemMetrics.AddAsync(systemMetric, ct);
    }
}