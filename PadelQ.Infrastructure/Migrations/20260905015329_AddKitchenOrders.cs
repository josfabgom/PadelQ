using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PadelQ.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddKitchenOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KitchenOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderNumber = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Status = table.Column<int>(type: "int", nullable: false),
                    BookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SpaceBookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KitchenOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KitchenOrders_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_KitchenOrders_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_KitchenOrders_SpaceBookings_SpaceBookingId",
                        column: x => x.SpaceBookingId,
                        principalTable: "SpaceBookings",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "KitchenOrderItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    KitchenOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BookingConsumptionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KitchenOrderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KitchenOrderItems_BookingConsumptions_BookingConsumptionId",
                        column: x => x.BookingConsumptionId,
                        principalTable: "BookingConsumptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_KitchenOrderItems_KitchenOrders_KitchenOrderId",
                        column: x => x.KitchenOrderId,
                        principalTable: "KitchenOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KitchenOrderItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KitchenOrderItems_BookingConsumptionId",
                table: "KitchenOrderItems",
                column: "BookingConsumptionId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenOrderItems_KitchenOrderId",
                table: "KitchenOrderItems",
                column: "KitchenOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenOrderItems_ProductId",
                table: "KitchenOrderItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenOrders_BookingId",
                table: "KitchenOrders",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenOrders_SpaceBookingId",
                table: "KitchenOrders",
                column: "SpaceBookingId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenOrders_UserId",
                table: "KitchenOrders",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KitchenOrderItems");

            migrationBuilder.DropTable(
                name: "KitchenOrders");
        }
    }
}
