using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NodePilot.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExtendSystemMetricsModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_read_failed_shape",
                table: "system_metrics");

            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_success_shape",
                table: "system_metrics");

            migrationBuilder.AddColumn<bool>(
                name: "cpu_enabled",
                table: "system_metrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ram_enabled",
                table: "system_metrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "successful_reads",
                table: "system_metrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "total_reads",
                table: "system_metrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_partial_success_shape",
                table: "system_metrics",
                sql: "(status != 1 OR (successful_reads > 0 AND successful_reads < total_reads AND failure_reason IS NOT NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_read_failed_shape",
                table: "system_metrics",
                sql: "(status != 2 OR (successful_reads = 0 AND failure_reason IS NOT NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_reads_valid",
                table: "system_metrics",
                sql: "total_reads >= 0 AND successful_reads >= 0 AND successful_reads <= total_reads");

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_success_shape",
                table: "system_metrics",
                sql: "(status != 0 OR (successful_reads = total_reads AND failure_reason IS NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_total_reads_matches_enabled_metrics",
                table: "system_metrics",
                sql: "total_reads = (CASE WHEN cpu_enabled THEN 1 ELSE 0 END) + (CASE WHEN ram_enabled THEN 1 ELSE 0 END)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_partial_success_shape",
                table: "system_metrics");

            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_read_failed_shape",
                table: "system_metrics");

            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_reads_valid",
                table: "system_metrics");

            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_success_shape",
                table: "system_metrics");

            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_total_reads_matches_enabled_metrics",
                table: "system_metrics");

            migrationBuilder.DropColumn(
                name: "cpu_enabled",
                table: "system_metrics");

            migrationBuilder.DropColumn(
                name: "ram_enabled",
                table: "system_metrics");

            migrationBuilder.DropColumn(
                name: "successful_reads",
                table: "system_metrics");

            migrationBuilder.DropColumn(
                name: "total_reads",
                table: "system_metrics");

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_read_failed_shape",
                table: "system_metrics",
                sql: "(status != 1 OR (cpu_usage_percent IS NULL AND ram_usage_percent IS NULL AND failure_reason IS NOT NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_success_shape",
                table: "system_metrics",
                sql: "(status != 0 OR (cpu_usage_percent IS NOT NULL AND ram_usage_percent IS NOT NULL AND failure_reason IS NULL))");
        }
    }
}
