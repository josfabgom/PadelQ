using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddArcaSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ArcaStatus",
                table: "Transactions",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Cae",
                table: "Transactions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CaeExpiration",
                table: "Transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "InvoiceNumber",
                table: "Transactions",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InvoiceType",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ArcaSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IsProduction = table.Column<bool>(type: "bit", nullable: false),
                    CuitEmisor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PuntoDeVenta = table.Column<int>(type: "int", nullable: false),
                    CondicionIva = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PrivateKeyPem = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CertificateCrtPem = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WsaaToken = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WsaaSign = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WsaaExpiration = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArcaSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArcaSettings");

            migrationBuilder.DropColumn(
                name: "ArcaStatus",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "Cae",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "CaeExpiration",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "InvoiceType",
                table: "Transactions");
        }
    }
}
