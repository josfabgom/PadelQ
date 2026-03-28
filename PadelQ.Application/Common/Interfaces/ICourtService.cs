using PadelQ.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PadelQ.Application.Common.Interfaces
{
    public interface ICourtService
    {
        Task<IEnumerable<Court>> GetAllAsync();
        Task<Court?> GetByIdAsync(int id);
        Task<int> CreateAsync(Court court);
        Task UpdateAsync(Court court);
        Task DeleteAsync(int id);
    }
}
