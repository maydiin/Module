using Microsoft.EntityFrameworkCore;
using Module.Data;

namespace Module.Data;

public interface IRepository
{
    Task<bool> ExistsAsync(string tableName, int id);
}

public class Repository : IRepository
{
    private readonly AppDbContext _context;

    public Repository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> ExistsAsync(string tableName, int id)
    {
        // Simple check if record exists in the dynamic records
        // RelationFieldType validates if an ID exists in another module's records
        return await _context.ModuleRecords
            .AnyAsync(r => r.Module.Name == tableName && r.Id == id);
    }
}
