using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMinimumStockToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MinimumStock",
                table: "Products",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MinimumStock",
                table: "Products");
        }
    }
}
