using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCashInAndOutToClosure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TotalCashIn",
                table: "CashClosures",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCashOut",
                table: "CashClosures",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActualTotals",
                table: "CashClosures",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SpecificDate",
                table: "ActivitySchedules",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalCashIn",
                table: "CashClosures");

            migrationBuilder.DropColumn(
                name: "TotalCashOut",
                table: "CashClosures");

            migrationBuilder.DropColumn(
                name: "ActualTotals",
                table: "CashClosures");

            migrationBuilder.DropColumn(
                name: "SpecificDate",
                table: "ActivitySchedules");
        }
    }
}
