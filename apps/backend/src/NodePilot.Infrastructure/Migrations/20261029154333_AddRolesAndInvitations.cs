using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NodePilot.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRolesAndInvitations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Before roles existed, the only account was the administrator created during setup.
            migrationBuilder.AddColumn<string>(
                name: "role",
                table: "users",
                type: "TEXT",
                maxLength: 16,
                nullable: false,
                defaultValue: "Admin");

            migrationBuilder.CreateTable(
                name: "invitations",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    token_hash = table.Column<string>(type: "TEXT", fixedLength: true, maxLength: 64, nullable: false),
                    role = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    created_by_user_id = table.Column<int>(type: "INTEGER", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    accepted_at_utc = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invitations", x => x.id);
                    table.CheckConstraint("ck_invitations_expires_after_created", "expires_at_utc > created_at_utc");
                    table.CheckConstraint("ck_invitations_role", "role IN ('Admin', 'Member')");
                    table.ForeignKey(
                        name: "FK_invitations_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_users_role",
                table: "users",
                sql: "role IN ('Admin', 'Member')");

            migrationBuilder.CreateIndex(
                name: "IX_invitations_created_by_user_id",
                table: "invitations",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ux_invitations_token_hash",
                table: "invitations",
                column: "token_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "invitations");

            migrationBuilder.DropCheckConstraint(
                name: "ck_users_role",
                table: "users");

            migrationBuilder.DropColumn(
                name: "role",
                table: "users");
        }
    }
}
