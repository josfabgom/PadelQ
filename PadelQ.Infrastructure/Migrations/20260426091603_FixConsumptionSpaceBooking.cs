using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixConsumptionSpaceBooking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BookingConsumptions_Bookings_BookingId",
                table: "BookingConsumptions");

            migrationBuilder.AlterColumn<Guid>(
                name: "BookingId",
                table: "BookingConsumptions",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "SpaceBookingId",
                table: "BookingConsumptions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BookingConsumptions_SpaceBookingId",
                table: "BookingConsumptions",
                column: "SpaceBookingId");

            migrationBuilder.AddForeignKey(
                name: "FK_BookingConsumptions_Bookings_BookingId",
                table: "BookingConsumptions",
                column: "BookingId",
                principalTable: "Bookings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BookingConsumptions_SpaceBookings_SpaceBookingId",
                table: "BookingConsumptions",
                column: "SpaceBookingId",
                principalTable: "SpaceBookings",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BookingConsumptions_Bookings_BookingId",
                table: "BookingConsumptions");

            migrationBuilder.DropForeignKey(
                name: "FK_BookingConsumptions_SpaceBookings_SpaceBookingId",
                table: "BookingConsumptions");

            migrationBuilder.DropIndex(
                name: "IX_BookingConsumptions_SpaceBookingId",
                table: "BookingConsumptions");

            migrationBuilder.DropColumn(
                name: "SpaceBookingId",
                table: "BookingConsumptions");

            migrationBuilder.AlterColumn<Guid>(
                name: "BookingId",
                table: "BookingConsumptions",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BookingConsumptions_Bookings_BookingId",
                table: "BookingConsumptions",
                column: "BookingId",
                principalTable: "Bookings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
