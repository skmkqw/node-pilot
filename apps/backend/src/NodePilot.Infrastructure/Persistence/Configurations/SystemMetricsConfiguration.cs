using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NodePilot.Application.Monitoring.Models;

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

        // CPU usage
        builder.Property(x => x.CpuEnabled)
            .HasColumnName("cpu_enabled")
            .IsRequired();


        builder.Property(x => x.CpuUsagePercent)
            .HasColumnName("cpu_usage_percent");

        // RAM usage 
        builder.Property(x => x.RamEnabled)
            .HasColumnName("ram_enabled")
            .IsRequired();

        builder.Property(x => x.RamUsagePercent)
            .HasColumnName("ram_usage_percent");

        // Reads (total and failed)
        builder.Property(x => x.TotalReads)
            .HasColumnName("total_reads")
            .IsRequired();

        builder.Property(x => x.SuccessfulReads)
            .HasColumnName("successful_reads")
            .IsRequired();

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

        // Amount of total reads is always greater or equal to failed reads
        builder.HasCheckConstraint(
            "ck_system_metrics_reads_valid",
            "total_reads >= 0 AND successful_reads >= 0 AND successful_reads <= total_reads");

        // Amount of total reads corresponds to configuration
        builder.HasCheckConstraint(
            "ck_system_metrics_total_reads_matches_enabled_metrics",
            "total_reads = " +
            "(CASE WHEN cpu_enabled THEN 1 ELSE 0 END) + " +
            "(CASE WHEN ram_enabled THEN 1 ELSE 0 END)");

        // CPU reads disabled and there is no valuue
        builder.HasCheckConstraint(
            "ck_system_metrics_cpu_disabled_has_no_value",
            "cpu_enabled OR cpu_usage_percent IS NULL");

        // CPU load is NULL OR between 0 and 100 %
        builder.HasCheckConstraint(
            "ck_system_metrics_cpu_usage_percent_range",
            "cpu_usage_percent IS NULL OR (cpu_usage_percent >= 0 AND cpu_usage_percent <= 100)");

        // RAM reads disabled and there is no valuue
        builder.HasCheckConstraint(
            "ck_system_metrics_ram_disabled_has_no_value",
            "ram_enabled OR ram_usage_percent IS NULL");

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
            "successful_reads = total_reads AND " +
            "failure_reason IS NULL" +
            ")" +
            ")");

        // Valid Partial Success Shape
        builder.HasCheckConstraint(
            "ck_system_metrics_partial_success_shape",
            "(" +
            "status != 1 OR " +
            "(" +
            "successful_reads > 0 AND " +
            "successful_reads < total_reads AND " +
            "failure_reason IS NOT NULL" +
            ")" +
            ")");

        // Valid Fail Shape
        builder.HasCheckConstraint(
            "ck_system_metrics_read_failed_shape",
            "(" +
            "status != 2 OR " +
            "(" +
            "successful_reads = 0 AND " +
            "failure_reason IS NOT NULL" +
            ")" +
            ")");
    }
}
