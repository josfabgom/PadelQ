using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface IArcaService
    {
        Task<bool> TestConnectionAsync();
        Task<(string PrivateKeyPem, string CsrPem)> GenerateCsrAsync(string cuit, string commonName);
        Task<bool> RequestElectronicInvoiceAsync(Guid paymentGroupId);
    }
}
