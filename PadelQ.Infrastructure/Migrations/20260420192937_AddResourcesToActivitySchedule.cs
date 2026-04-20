using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddResourcesToActivitySchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CourtId",
                table: "ActivitySchedules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SpaceId",
                table: "ActivitySchedules",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ActivitySchedules_CourtId",
                table: "ActivitySchedules",
                column: "CourtId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivitySchedules_SpaceId",
                table: "ActivitySchedules",
                column: "SpaceId");

            migrationBuilder.AddForeignKey(
                name: "FK_ActivitySchedules_Courts_CourtId",
                table: "ActivitySchedules",
                column: "CourtId",
                principalTable: "Courts",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ActivitySchedules_Spaces_SpaceId",
                table: "ActivitySchedules",
                column: "SpaceId",
                principalTable: "Spaces",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ActivitySchedules_Courts_CourtId",
                table: "ActivitySchedules");

            migrationBuilder.DropForeignKey(
                name: "FK_ActivitySchedules_Spaces_SpaceId",
                table: "ActivitySchedules");

            migrationBuilder.DropIndex(
                name: "IX_ActivitySchedules_CourtId",
                table: "ActivitySchedules");

            migrationBuilder.DropIndex(
                name: "IX_ActivitySchedules_SpaceId",
                table: "ActivitySchedules");

            migrationBuilder.DropColumn(
                name: "CourtId",
                table: "ActivitySchedules");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "ActivitySchedules");
        }
    }
}
