using Microsoft.EntityFrameworkCore;
using NodePilot.Application.SystemStatus;

namespace NodePilot.Infrastructure.Persistence;

public sealed class NodePilotDbContext(DbContextOptions<NodePilotDbContext> options) : DbContext(options)
{
    public DbSet<SystemMetric> SystemMetrics => Set<SystemMetric>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NodePilotDbContext).Assembly);
    }
}
