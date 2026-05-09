using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserIdToConsumption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /*
            migrationBuilder.AddColumn<Guid>(
                name: "BookingId",
                table: "Transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SpaceBookingId",
                table: "Transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCashIn",
                table: "CashClosures",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCashOut",
                table: "CashClosures",
                type: "decimal(18,2)",
                nullable: true);
            */

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "BookingConsumptions",
                type: "nvarchar(450)",
                nullable: true);

            /*
            migrationBuilder.AddColumn<DateTime>(
                name: "SpecificDate",
                table: "ActivitySchedules",
                type: "datetime2",
                nullable: true);
            */

            migrationBuilder.CreateIndex(
                name: "IX_BookingConsumptions_UserId",
                table: "BookingConsumptions",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_BookingConsumptions_AspNetUsers_UserId",
                table: "BookingConsumptions",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BookingConsumptions_AspNetUsers_UserId",
                table: "BookingConsumptions");

            migrationBuilder.DropIndex(
                name: "IX_BookingConsumptions_UserId",
                table: "BookingConsumptions");

            migrationBuilder.DropColumn(
                name: "BookingId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "SpaceBookingId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "TotalCashIn",
                table: "CashClosures");

            migrationBuilder.DropColumn(
                name: "TotalCashOut",
                table: "CashClosures");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "BookingConsumptions");

            migrationBuilder.DropColumn(
                name: "SpecificDate",
                table: "ActivitySchedules");
        }
    }
}
