using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Module.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiStageApprovals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CurrentStage",
                table: "ApprovalRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ApprovalStages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApprovalRequestId = table.Column<int>(type: "int", nullable: false),
                    StageOrder = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AssignedToRoleId = table.Column<int>(type: "int", nullable: true),
                    AssignedToUserId = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Comments = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResolvedByUserId = table.Column<int>(type: "int", nullable: true),
                    TimeoutHours = table.Column<int>(type: "int", nullable: true),
                    EscalationAction = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    EscalateToRoleId = table.Column<int>(type: "int", nullable: true),
                    EscalationDeadline = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Escalated = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalStages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApprovalStages_ApprovalRequests_ApprovalRequestId",
                        column: x => x.ApprovalRequestId,
                        principalTable: "ApprovalRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ApprovalStages_Roles_AssignedToRoleId",
                        column: x => x.AssignedToRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApprovalStages_Roles_EscalateToRoleId",
                        column: x => x.EscalateToRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApprovalStages_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApprovalStages_Users_AssignedToUserId",
                        column: x => x.AssignedToUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApprovalStages_Users_ResolvedByUserId",
                        column: x => x.ResolvedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalStages_ApprovalRequestId",
                table: "ApprovalStages",
                column: "ApprovalRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalStages_AssignedToRoleId",
                table: "ApprovalStages",
                column: "AssignedToRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalStages_AssignedToUserId",
                table: "ApprovalStages",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalStages_EscalateToRoleId",
                table: "ApprovalStages",
                column: "EscalateToRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalStages_ResolvedByUserId",
                table: "ApprovalStages",
                column: "ResolvedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalStages_Status",
                table: "ApprovalStages",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalStages_TenantId_ApprovalRequestId",
                table: "ApprovalStages",
                columns: new[] { "TenantId", "ApprovalRequestId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApprovalStages");

            migrationBuilder.DropColumn(
                name: "CurrentStage",
                table: "ApprovalRequests");
        }
    }
}
