using Microsoft.EntityFrameworkCore;
using Module.Data;

namespace Module.Services.Caching;

public class ModuleCacheService : IModuleCacheService
{
    private readonly ICacheService _cacheService;
    private readonly IServiceProvider _serviceProvider;

    public ModuleCacheService(ICacheService cacheService, IServiceProvider serviceProvider)
    {
        _cacheService = cacheService;
        _serviceProvider = serviceProvider;
    }

    public async Task<Entities.Module?> GetModuleAsync(int moduleId)
    {
        var cacheKey = $"module_id_{moduleId}";
        
        return await _cacheService.GetOrCreateAsync(cacheKey, async () =>
        {
            // Resolve AppDbContext from scope since DbContext is Scoped and CacheService might be Singleton
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await context.Modules.Include(m => m.Fields).FirstOrDefaultAsync(m => m.Id == moduleId);
        });
    }

    public async Task<Entities.Module?> GetModuleByNameAsync(string name, int tenantId)
    {
        var cacheKey = $"module_name_{tenantId}_{name}";
        
        return await _cacheService.GetOrCreateAsync(cacheKey, async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await context.Modules.Include(m => m.Fields).FirstOrDefaultAsync(m => m.Name == name && m.TenantId == tenantId);
        });
    }

    public void InvalidateModule(int moduleId, string? moduleName, int tenantId)
    {
        _cacheService.Remove($"module_id_{moduleId}");
        
        if (!string.IsNullOrEmpty(moduleName))
        {
            _cacheService.Remove($"module_name_{tenantId}_{moduleName}");
        }
    }
}
