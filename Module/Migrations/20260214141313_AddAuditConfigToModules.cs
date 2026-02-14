using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Module.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditConfigToModules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AuditCreate",
                table: "Modules",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AuditDelete",
                table: "Modules",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AuditUpdate",
                table: "Modules",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AuditCreate",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "AuditDelete",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "AuditUpdate",
                table: "Modules");
        }
    }
}
