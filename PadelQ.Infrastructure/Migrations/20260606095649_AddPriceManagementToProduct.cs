using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPriceManagementToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "InternalTaxAmount",
                table: "Products",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "IvaPercentage",
                table: "Products",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MarginPercentage",
                table: "Products",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InternalTaxAmount",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "IvaPercentage",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "MarginPercentage",
                table: "Products");
        }
    }
}
