using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Module.Migrations
{
    /// <inheritdoc />
    public partial class AddModuleVisibilityRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "ModuleRecords",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ModuleVisibilityRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModuleId = table.Column<int>(type: "int", nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: true),
                    Field = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Operator = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleVisibilityRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleVisibilityRules_Modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "Modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ModuleVisibilityRules_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ModuleVisibilityRules_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ModuleRecords_CreatedByUserId",
                table: "ModuleRecords",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleVisibilityRules_ModuleId",
                table: "ModuleVisibilityRules",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleVisibilityRules_RoleId",
                table: "ModuleVisibilityRules",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleVisibilityRules_TenantId_ModuleId",
                table: "ModuleVisibilityRules",
                columns: new[] { "TenantId", "ModuleId" });

            migrationBuilder.AddForeignKey(
                name: "FK_ModuleRecords_Users_CreatedByUserId",
                table: "ModuleRecords",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ModuleRecords_Users_CreatedByUserId",
                table: "ModuleRecords");

            migrationBuilder.DropTable(
                name: "ModuleVisibilityRules");

            migrationBuilder.DropIndex(
                name: "IX_ModuleRecords_CreatedByUserId",
                table: "ModuleRecords");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "ModuleRecords");
        }
    }
}
