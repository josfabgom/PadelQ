using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFractionsToBookings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Activity columns removed

            migrationBuilder.AddColumn<int>(
                name: "RentFractions",
                table: "SpaceBookings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Combo and Instructor columns removed

            migrationBuilder.AddColumn<int>(
                name: "RentFractions",
                table: "Bookings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Fractions",
                table: "BookingConsumptions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // IsComboRedeemed and FKs removed
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // FKs and Activity columns drops removed

            migrationBuilder.DropColumn(
                name: "RentFractions",
                table: "SpaceBookings");

            // Drops removed

            migrationBuilder.DropColumn(
                name: "RentFractions",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Fractions",
                table: "BookingConsumptions");

            // Drop removed
        }
    }
}
