using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Module.Data;

namespace Module.Services;

public interface ITenantService
{
    int GetCurrentTenantId();
    bool IsSuperAdmin();
    Task<bool> IsSuperAdminAsync();
}

public class TenantService : ITenantService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly AppDbContext _context;

    public TenantService(IHttpContextAccessor httpContextAccessor, AppDbContext context)
    {
        _httpContextAccessor = httpContextAccessor;
        _context = context;
    }

    public int GetCurrentTenantId()
    {
        // Super Admin can override tenant via X-Tenant-Id header
        if (IsSuperAdmin())
        {
            var headerValue = _httpContextAccessor.HttpContext?.Request.Headers["X-Tenant-Id"].FirstOrDefault();
            if (!string.IsNullOrEmpty(headerValue) && int.TryParse(headerValue, out var overrideTenantId))
            {
                return overrideTenantId;
            }
        }

        // Default: use tenant from JWT claim
        var tenantIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst("TenantId");
        if (tenantIdClaim != null && int.TryParse(tenantIdClaim.Value, out var tenantId))
        {
            return tenantId;
        }
        return 0; // No tenant context
    }

    public bool IsSuperAdmin()
    {
        var isSuperAdminClaim = _httpContextAccessor.HttpContext?.User.FindFirst("IsSuperAdmin");
        return isSuperAdminClaim?.Value == "True";
    }

    public async Task<bool> IsSuperAdminAsync()
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
        {
            return false;
        }

        // Check if user has Super Admin role
        var hasSuperAdminRole = await _context.UserRoles
            .Include(ur => ur.Role)
            .AnyAsync(ur => ur.UserId == userId && ur.Role.Name == "Super Admin");

        return hasSuperAdminRole;
    }
}
