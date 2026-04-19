using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NodePilot.Application.SystemStatus;

namespace NodePilot.Infrastructure.Persistence.Configurations;

public class SystemMetricsConfiguration : IEntityTypeConfiguration<SystemMetric>
{
    [Obsolete]
    public void Configure(EntityTypeBuilder<SystemMetric> builder)
    {
        builder.ToTable("system_metrics");

        // Primary key
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        // Timestamp
        builder.Property(x => x.CollectedAtUtc)
            .HasColumnName("collected_at_utc")
            .IsRequired();

        // Metrics read status
        builder.Property(x => x.Status)
            .HasColumnName("status")
            .HasConversion<int>()
            .IsRequired();

        // RAM usage 
        builder.Property(x => x.CpuUsagePercent)
            .HasColumnName("cpu_usage_percent");

        // CPU usage 
        builder.Property(x => x.RamUsagePercent)
            .HasColumnName("ram_usage_percent");

        // Failure Reason
        builder.Property(x => x.FailureReason)
            .HasColumnName("failure_reason")
            .HasMaxLength(500);

        // Timestamp Index
        builder.HasIndex(x => x.CollectedAtUtc)
            .HasDatabaseName("ix_system_metrics_collected_at_utc");

        // Status + Timestamp Index
        builder.HasIndex(x => new { x.Status, x.CollectedAtUtc })
            .HasDatabaseName("ix_system_metrics_status_collected_at_utc");

        // RAM load is NULL OR between 0 and 100 %
        builder.HasCheckConstraint(
            "ck_system_metrics_cpu_usage_percent_range",
            "cpu_usage_percent IS NULL OR (cpu_usage_percent >= 0 AND cpu_usage_percent <= 100)");

        // RAM load is NULL OR between 0 and 100 %
        builder.HasCheckConstraint(
            "ck_system_metrics_ram_usage_percent_range",
            "ram_usage_percent IS NULL OR (ram_usage_percent >= 0 AND ram_usage_percent <= 100)");

        // Valid Success Shape
        builder.HasCheckConstraint(
            "ck_system_metrics_success_shape",
            "(" +
            "status != 0 OR " +
            "(" +
            "cpu_usage_percent IS NOT NULL AND " +
            "ram_usage_percent IS NOT NULL AND " +
            "failure_reason IS NULL" +
            ")" +
            ")");

        // Valid Fail Shape
        builder.HasCheckConstraint(
            "ck_system_metrics_read_failed_shape",
            "(" +
            "status != 1 OR " +
            "(" +
            "cpu_usage_percent IS NULL AND " +
            "ram_usage_percent IS NULL AND " +
            "failure_reason IS NOT NULL" +
            ")" +
            ")");
    }
}
