using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Module.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Modules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Modules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecordRelations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SourceModule = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SourceRecordId = table.Column<int>(type: "int", nullable: false),
                    TargetModule = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TargetRecordId = table.Column<int>(type: "int", nullable: false),
                    FieldName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecordRelations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExternalApiConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModuleId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Url = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    HeadersJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RequestBodyTemplate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResponseMappingsJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalApiConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExternalApiConfigs_Modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "Modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModuleFields",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModuleId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Required = table.Column<bool>(type: "bit", nullable: false),
                    Options = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsStored = table.Column<bool>(type: "bit", nullable: false),
                    OrderNo = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFields", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleFields_Modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "Modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModuleRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModuleId = table.Column<int>(type: "int", nullable: false),
                    Data = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleRecords_Modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "Modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExternalApiConfigs_ModuleId",
                table: "ExternalApiConfigs",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFields_ModuleId_Name",
                table: "ModuleFields",
                columns: new[] { "ModuleId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModuleRecords_CreatedAt",
                table: "ModuleRecords",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleRecords_ModuleId",
                table: "ModuleRecords",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_Modules_Name",
                table: "Modules",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_RecordRelations_SourceModule_SourceRecordId",
                table: "RecordRelations",
                columns: new[] { "SourceModule", "SourceRecordId" });

            migrationBuilder.CreateIndex(
                name: "IX_RecordRelations_TargetModule_TargetRecordId",
                table: "RecordRelations",
                columns: new[] { "TargetModule", "TargetRecordId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExternalApiConfigs");

            migrationBuilder.DropTable(
                name: "ModuleFields");

            migrationBuilder.DropTable(
                name: "ModuleRecords");

            migrationBuilder.DropTable(
                name: "RecordRelations");

            migrationBuilder.DropTable(
                name: "Modules");
        }
    }
}
