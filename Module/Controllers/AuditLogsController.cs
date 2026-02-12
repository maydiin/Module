using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Services;
using Module.Authorization;

namespace Module.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize]
[HasPermission("AuditLog.View")]
public class AuditLogsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;

    public AuditLogsController(AppDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var isSuperAdmin = _tenantService.IsSuperAdmin();

        var query = _context.AuditLogs.AsQueryable();

        // Tenant scoping: non-super-admins see only their tenant's logs
        if (!isSuperAdmin)
        {
            query = query.Where(a => a.TenantId == tenantId);
        }
        else if (tenantId > 0)
        {
            // Super admin with a specific tenant selected
            query = query.Where(a => a.TenantId == tenantId);
        }

        // Filters
        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(a => a.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            query = query.Where(a => a.EntityType == entityType);
        }

        if (startDate.HasValue)
        {
            query = query.Where(a => a.Timestamp >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(a => a.Timestamp <= endDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(a =>
                (a.EntityName != null && a.EntityName.ToLower().Contains(searchLower)) ||
                (a.Username != null && a.Username.ToLower().Contains(searchLower)) ||
                (a.Details != null && a.Details.ToLower().Contains(searchLower)));
        }

        var totalCount = await query.CountAsync();

        var logs = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.Action,
                a.EntityType,
                a.EntityId,
                a.EntityName,
                a.UserId,
                a.Username,
                a.TenantId,
                a.Timestamp,
                a.Details,
                a.IpAddress
            })
            .ToListAsync();

        return Ok(new
        {
            data = logs,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }
}
