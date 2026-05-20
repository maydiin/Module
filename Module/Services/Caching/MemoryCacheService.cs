using Microsoft.Extensions.Caching.Memory;

namespace Module.Services.Caching;

public class MemoryCacheService : ICacheService
{
    private readonly IMemoryCache _memoryCache;
    private readonly TimeSpan _defaultExpiration = TimeSpan.FromHours(1);

    public MemoryCacheService(IMemoryCache memoryCache)
    {
        _memoryCache = memoryCache;
    }

    public async Task<T?> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiration = null)
    {
        if (!_memoryCache.TryGetValue(key, out T? result))
        {
            result = await factory();

            if (result != null)
            {
                var cacheEntryOptions = new MemoryCacheEntryOptions()
                    .SetSlidingExpiration(expiration ?? _defaultExpiration);

                _memoryCache.Set(key, result, cacheEntryOptions);
            }
        }

        return result;
    }

    public void Remove(string key)
    {
        _memoryCache.Remove(key);
    }
}
