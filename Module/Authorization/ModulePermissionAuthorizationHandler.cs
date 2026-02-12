using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Module.Data;

namespace Module.Authorization;

/// <summary>
/// Authorization handler for module-specific permissions.
/// Resolves Module.{ModuleName}.{Action} at runtime based on route data.
/// </summary>
public class ModulePermissionAuthorizationHandler : AuthorizationHandler<ModulePermissionRequirement>
{
    private readonly AppDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ModulePermissionAuthorizationHandler(AppDbContext context, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ModulePermissionRequirement requirement)
    {
        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier) ?? context.User.FindFirst("sub");
        if (userIdClaim == null)
        {
            return;
        }

        if (!int.TryParse(userIdClaim.Value, out var userId))
        {
            return;
        }

        // Super Admin bypasses all permission checks
        var isSuperAdminClaim = context.User.FindFirst("IsSuperAdmin");
        if (isSuperAdminClaim != null && bool.TryParse(isSuperAdminClaim.Value, out var isSuperAdmin) && isSuperAdmin)
        {
            context.Succeed(requirement);
            return;
        }

        // Get module name from route data
        var routeData = _httpContextAccessor.HttpContext?.GetRouteData();
        if (routeData == null)
        {
            return;
        }

        string? moduleName = null;
        
        // Try to get module name from moduleId in route
        if (routeData.Values.TryGetValue("moduleId", out var moduleIdStr) && int.TryParse(moduleIdStr?.ToString(), out var moduleId))
        {
            moduleName = await _context.Modules
                .Where(m => m.Id == moduleId)
                .Select(m => m.Name)
                .FirstOrDefaultAsync();
        }
        // Or directly from moduleName in route
        else if (routeData.Values.TryGetValue("moduleName", out var mName))
        {
            moduleName = mName?.ToString();
        }

        if (string.IsNullOrEmpty(moduleName))
        {
            // Cannot determine module name
            return;
        }

        // Construct the permission name: Module.{ModuleName}.{Action}
        var permissionToCheck = $"Module.{moduleName}.{requirement.Action}";

        // Check if the user has the required permission through their roles
        var hasPermission = await _context.UserRoles
            .Where(ur => ur.UserId == userId)
            .Select(ur => ur.Role)
            .SelectMany(r => r.RolePermissions)
            .AnyAsync(rp => rp.Permission.Name == permissionToCheck);

        if (hasPermission)
        {
            context.Succeed(requirement);
        }
    }
}
