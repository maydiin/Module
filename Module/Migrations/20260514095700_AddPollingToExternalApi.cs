using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Module.Migrations
{
    /// <inheritdoc />
    public partial class AddPollingToExternalApi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPollingEnabled",
                table: "ExternalApiConfigs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastPolledAt",
                table: "ExternalApiConfigs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PollingIntervalMinutes",
                table: "ExternalApiConfigs",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPollingEnabled",
                table: "ExternalApiConfigs");

            migrationBuilder.DropColumn(
                name: "LastPolledAt",
                table: "ExternalApiConfigs");

            migrationBuilder.DropColumn(
                name: "PollingIntervalMinutes",
                table: "ExternalApiConfigs");
        }
    }
}
