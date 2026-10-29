using Microsoft.EntityFrameworkCore;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Monitoring.Models;
using NodePilot.Application.Settings.Models;

namespace NodePilot.Infrastructure.Persistence;

public sealed class NodePilotDbContext(DbContextOptions<NodePilotDbContext> options) : DbContext(options)
{
    public DbSet<SystemMetric> SystemMetrics => Set<SystemMetric>();

    public DbSet<UserAccount> Users => Set<UserAccount>();

    public DbSet<Invitation> Invitations => Set<Invitation>();

    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NodePilotDbContext).Assembly);
    }
}
