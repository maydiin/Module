using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Module.Migrations
{
    /// <inheritdoc />
    public partial class AddUserModuleLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LinkedModuleId",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LinkedRecordId",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_LinkedModuleId",
                table: "Users",
                column: "LinkedModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_LinkedRecordId",
                table: "Users",
                column: "LinkedRecordId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_ModuleRecords_LinkedRecordId",
                table: "Users",
                column: "LinkedRecordId",
                principalTable: "ModuleRecords",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Modules_LinkedModuleId",
                table: "Users",
                column: "LinkedModuleId",
                principalTable: "Modules",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_ModuleRecords_LinkedRecordId",
                table: "Users");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Modules_LinkedModuleId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_LinkedModuleId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_LinkedRecordId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LinkedModuleId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LinkedRecordId",
                table: "Users");
        }
    }
}
