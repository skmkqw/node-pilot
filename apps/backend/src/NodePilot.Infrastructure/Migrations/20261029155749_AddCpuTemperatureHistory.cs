using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NodePilot.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCpuTemperatureHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "cpu_temperature_celsius",
                table: "system_metrics",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_system_metrics_cpu_temperature_range",
                table: "system_metrics",
                sql: "cpu_temperature_celsius IS NULL OR (cpu_temperature_celsius >= -40 AND cpu_temperature_celsius <= 150)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_system_metrics_cpu_temperature_range",
                table: "system_metrics");

            migrationBuilder.DropColumn(
                name: "cpu_temperature_celsius",
                table: "system_metrics");
        }
    }
}
