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

        }
    }
}
