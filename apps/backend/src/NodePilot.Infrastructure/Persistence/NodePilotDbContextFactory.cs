using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace NodePilot.Infrastructure.Persistence;

public sealed class NodePilotDbContextFactory : IDesignTimeDbContextFactory<NodePilotDbContext>
{
    public NodePilotDbContext CreateDbContext(string[] args)
    {
        var connectionString = DatabaseExtensions.ResolveConnectionString();

        DatabaseExtensions.EnsureSqliteDirectoryExists(connectionString);

        var options = new DbContextOptionsBuilder<NodePilotDbContext>()
            .UseSqlite(connectionString)
            .Options;

        return new NodePilotDbContext(options);
    }
}
