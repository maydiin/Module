using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Module.Data;

namespace Module.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly AppDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PermissionAuthorizationHandler(AppDbContext context, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
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

        var permissionToCheck = requirement.Permission;

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
