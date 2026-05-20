namespace Module.Services.Caching;

public interface IModuleCacheService
{
    Task<Entities.Module?> GetModuleAsync(int moduleId);
    Task<Entities.Module?> GetModuleByNameAsync(string name, int tenantId);
    void InvalidateModule(int moduleId, string? moduleName, int tenantId);
}
