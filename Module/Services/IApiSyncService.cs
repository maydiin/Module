using Module.Entities;

namespace Module.Services;

public interface IApiSyncService
{
    Task<ApiSyncResult> ExecuteSyncAsync(int configId, int tenantId, Dictionary<string, string>? parameters = null);
}

public class ApiSyncResult
{
    public string Message { get; set; } = string.Empty;
    public string ModuleName { get; set; } = string.Empty;
    public int CreatedCount { get; set; }
    public int FailedCount { get; set; }
    public List<string> Errors { get; set; } = new();
}
