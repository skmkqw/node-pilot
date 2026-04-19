using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NodePilot.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "system_metrics",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    cpu_usage_percent = table.Column<double>(type: "REAL", nullable: true),
                    ram_usage_percent = table.Column<double>(type: "REAL", nullable: true),
                    status = table.Column<int>(type: "INTEGER", nullable: false),
                    failure_reason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    collected_at_utc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_metrics", x => x.id);
                    table.CheckConstraint("ck_system_metrics_cpu_usage_percent_range", "cpu_usage_percent IS NULL OR (cpu_usage_percent >= 0 AND cpu_usage_percent <= 100)");
                    table.CheckConstraint("ck_system_metrics_ram_usage_percent_range", "ram_usage_percent IS NULL OR (ram_usage_percent >= 0 AND ram_usage_percent <= 100)");
                    table.CheckConstraint("ck_system_metrics_read_failed_shape", "(status != 1 OR (cpu_usage_percent IS NULL AND ram_usage_percent IS NULL AND failure_reason IS NOT NULL))");
                    table.CheckConstraint("ck_system_metrics_success_shape", "(status != 0 OR (cpu_usage_percent IS NOT NULL AND ram_usage_percent IS NOT NULL AND failure_reason IS NULL))");
                });

            migrationBuilder.CreateIndex(
                name: "ix_system_metrics_collected_at_utc",
                table: "system_metrics",
                column: "collected_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_system_metrics_status_collected_at_utc",
                table: "system_metrics",
                columns: new[] { "status", "collected_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "system_metrics");
        }
    }
}
