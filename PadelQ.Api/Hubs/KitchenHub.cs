using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace PadelQ.Api.Hubs
{
    [Authorize(Roles = "Admin,Cocinero")]
    public class KitchenHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Cocineros");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(System.Exception? exception)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "Cocineros");
            await base.OnDisconnectedAsync(exception);
        }
    }
}
