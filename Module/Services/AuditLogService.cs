using System.Security.Claims;
using Module.Data;
using Module.Entities;

namespace Module.Services;

public class AuditLogService : IAuditLogService
{
    private readonly AppDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ITenantService _tenantService;

    public AuditLogService(AppDbContext context, IHttpContextAccessor httpContextAccessor, ITenantService tenantService)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _tenantService = tenantService;
    }

    public async Task LogAsync(string action, string entityType, string? entityId = null, string? entityName = null, string? details = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;

        int? userId = null;
        string? username = null;

        var userIdClaim = httpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && int.TryParse(userIdClaim, out var parsedUserId))
        {
            userId = parsedUserId;
        }
        username = httpContext?.User.FindFirst(ClaimTypes.Name)?.Value;

        var tenantId = 0;
        try
        {
            tenantId = _tenantService.GetCurrentTenantId();
        }
        catch
        {
            // Tenant context may not be available (e.g. during login/register)
        }

        var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString();

        var auditLog = new AuditLog
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            EntityName = entityName,
            UserId = userId,
            Username = username,
            TenantId = tenantId,
            Timestamp = DateTime.UtcNow,
            Details = details,
            IpAddress = ipAddress
        };

        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
    }
}
