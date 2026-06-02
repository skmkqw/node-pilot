using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NodePilot.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdditionalConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_cpu_disabled_has_no_value",
                table: "system_metrics",
                sql: "cpu_enabled OR cpu_usage_percent IS NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_ram_disabled_has_no_value",
                table: "system_metrics",
                sql: "ram_enabled OR ram_usage_percent IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_cpu_disabled_has_no_value",
                table: "system_metrics");

            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_ram_disabled_has_no_value",
                table: "system_metrics");
        }
    }
}
