namespace Module.Services.Caching;

public interface ITenantCacheService
{
    Task<Entities.Tenant?> GetTenantAsync(int tenantId);
    void InvalidateTenant(int tenantId);
}
