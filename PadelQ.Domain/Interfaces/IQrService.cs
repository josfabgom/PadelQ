using System.Threading.Tasks;

namespace PadelQ.Domain.Interfaces
{
    public interface IQrService
    {
        (string Token, string ShortCode) GenerateToken(string userId);
        bool ValidateToken(string token, out string userId);
    }
}
