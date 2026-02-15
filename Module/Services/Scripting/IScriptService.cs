using Module.DTOs;

namespace Module.Services.Scripting;

public interface IScriptService
{
    Task<PagedResult<ModuleRecordDto>?> ExecuteListOverrideAsync(int moduleId, int tenantId, RecordQueryOptions options);
    Task ExecuteBeforeHookAsync(string trigger, int moduleId, Dictionary<string, object> data);
    Task ExecuteAfterHookAsync(string trigger, int moduleId, Dictionary<string, object> data);
}

public class RecordQueryOptions
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public string? Filters { get; set; }
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
}
