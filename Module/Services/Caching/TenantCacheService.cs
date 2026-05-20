using Microsoft.EntityFrameworkCore;
using Module.Data;

namespace Module.Services.Caching;

public class TenantCacheService : ITenantCacheService
{
    private readonly ICacheService _cacheService;
    private readonly IServiceProvider _serviceProvider;

    public TenantCacheService(ICacheService cacheService, IServiceProvider serviceProvider)
    {
        _cacheService = cacheService;
        _serviceProvider = serviceProvider;
    }

    public async Task<Entities.Tenant?> GetTenantAsync(int tenantId)
    {
        var cacheKey = $"tenant_id_{tenantId}";
        
        return await _cacheService.GetOrCreateAsync(cacheKey, async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
        });
    }

    public void InvalidateTenant(int tenantId)
    {
        _cacheService.Remove($"tenant_id_{tenantId}");
    }
}
