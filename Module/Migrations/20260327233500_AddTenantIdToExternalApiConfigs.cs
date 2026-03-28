using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Module.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantIdToExternalApiConfigs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "ExternalApiConfigs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_ExternalApiConfigs_TenantId",
                table: "ExternalApiConfigs",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_ExternalApiConfigs_Tenants_TenantId",
                table: "ExternalApiConfigs",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExternalApiConfigs_Tenants_TenantId",
                table: "ExternalApiConfigs");

            migrationBuilder.DropIndex(
                name: "IX_ExternalApiConfigs_TenantId",
                table: "ExternalApiConfigs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ExternalApiConfigs");
        }
    }
}
