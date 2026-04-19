using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace NodePilot.Infrastructure.Persistence.Configurations;

public class SystemMetricsConfigurations : IEntityTypeConfiguration<SystemMetric>
{
    [Obsolete]
    public void Configure(EntityTypeBuilder<SystemMetric> builder)
    {
        builder.ToTable("system_builders");

        // Primary Key
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedOnAdd();

        // Timestamp
        builder.Property(x => x.CollectedAtUtc)
            .IsRequired();

        builder.HasIndex(x => x.CollectedAtUtc)
            .HasDatabaseName("ix_system_metrics_collected_at_utc");

        // CPU Usage
        builder.Property(x => x.CpuUsagePercent)
            .IsRequired();

        // RAM Usage
        builder.Property(x => x.RamUsagePercent)
            .IsRequired();

        // CPU load between 0 and 100 %
        builder.HasCheckConstraint(
            "ck_system_metrics_cpu_usage_percent_range",
            "cpu_usage_percent >= 0 AND cpu_usage_percent <= 100");
        
        // RAM load between 0 and 100 %
        builder.HasCheckConstraint(
            "ck_system_metrics_ram_usage_percent_range",
            "ram_usage_percent >= 0 AND ram_usage_percent <= 100");
    }
}
