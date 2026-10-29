using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NodePilot.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountsAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_settings",
                columns: table => new
                {
                    key = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    value = table.Column<string>(type: "TEXT", maxLength: 4096, nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_settings", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    username = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false, collation: "NOCASE"),
                    password_hash = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    password_changed_at_utc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ux_users_username",
                table: "users",
                column: "username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_settings");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
