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
                name: "system_builders",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CpuUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    RamUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    CollectedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_builders", x => x.Id);
                    table.CheckConstraint("ck_system_metrics_cpu_usage_percent_range", "cpu_usage_percent >= 0 AND cpu_usage_percent <= 100");
                    table.CheckConstraint("ck_system_metrics_ram_usage_percent_range", "ram_usage_percent >= 0 AND ram_usage_percent <= 100");
                });

            migrationBuilder.CreateIndex(
                name: "ix_system_metrics_collected_at_utc",
                table: "system_builders",
                column: "CollectedAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "system_builders");
        }
    }
}
