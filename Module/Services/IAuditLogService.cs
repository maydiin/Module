namespace Module.Services;

public interface IAuditLogService
{
    Task LogAsync(string action, string entityType, string? entityId = null, string? entityName = null, string? details = null);
}
