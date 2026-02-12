using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Authorization;
using Module.Data;
using Module.Entities;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize]
[HasPermission("Role.Manage")]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;

    public RolesController(AppDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var roles = await _context.Roles
            .Where(r => r.TenantId == tenantId)
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .Select(r => new {
                r.Id,
                r.Name,
                r.Description,
                Permissions = r.RolePermissions.Select(rp => rp.Permission.Name)
            })
            .ToListAsync();
        return Ok(roles);
    }

    [HttpGet("permissions")]
    public async Task<IActionResult> GetAllPermissions()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var permissions = await _context.Permissions
            .Where(p => p.TenantId == tenantId)
            .Select(p => p.Name)
            .ToListAsync();
        return Ok(permissions);
    }

    [HttpPost("{roleId}/permissions")]
    public async Task<IActionResult> AddPermission(int roleId, [FromBody] PermissionAssignmentDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var role = await _context.Roles
            .Include(r => r.RolePermissions)
            .FirstOrDefaultAsync(r => r.Id == roleId && r.TenantId == tenantId);
        if (role == null) return NotFound();

        var permission = await _context.Permissions.FirstOrDefaultAsync(p => p.Name == dto.PermissionName && p.TenantId == tenantId);
        if (permission == null) return BadRequest(new { error = "Permission not found" });

        if (role.RolePermissions.Any(rp => rp.PermissionId == permission.Id)) return BadRequest(new { error = "Role already has this permission" });

        _context.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = permission.Id });
        await _context.SaveChangesAsync();
        
        // Check if the current user has this role
        var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        var currentUserHasRole = await _context.UserRoles.AnyAsync(ur => ur.UserId == currentUserId && ur.RoleId == roleId);
        
        return Ok(new { shouldRefreshToken = currentUserHasRole });
    }

    [HttpDelete("{roleId}/permissions/{permissionName}")]
    public async Task<IActionResult> RemovePermission(int roleId, string permissionName)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        // Verify role belongs to current tenant
        var roleExists = await _context.Roles.AnyAsync(r => r.Id == roleId && r.TenantId == tenantId);
        if (!roleExists) return NotFound();
        
        var rolePermission = await _context.RolePermissions
            .Include(rp => rp.Permission)
            .FirstOrDefaultAsync(rp => rp.RoleId == roleId && rp.Permission.Name == permissionName);
            
        if (rolePermission == null) return NotFound();

        _context.RolePermissions.Remove(rolePermission);
        await _context.SaveChangesAsync();
        
        // Check if the current user has this role
        var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        var currentUserHasRole = await _context.UserRoles.AnyAsync(ur => ur.UserId == currentUserId && ur.RoleId == roleId);
        
        return Ok(new { shouldRefreshToken = currentUserHasRole });
    }

    [HttpPost]
    public async Task<IActionResult> CreateRole([FromBody] RoleCreateUpdateDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        if (await _context.Roles.AnyAsync(r => r.Name == dto.Name && r.TenantId == tenantId))
            return BadRequest(new { error = "Role already exists" });

        var role = new Role
        {
            Name = dto.Name,
            Description = dto.Description,
            TenantId = tenantId
        };

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();
        return Ok(role);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] RoleCreateUpdateDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);
        if (role == null) return NotFound();

        if (await _context.Roles.AnyAsync(r => r.Name == dto.Name && r.Id != id && r.TenantId == tenantId))
            return BadRequest(new { error = "Role name already in use" });

        role.Name = dto.Name;
        role.Description = dto.Description;

        await _context.SaveChangesAsync();
        return Ok(role);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);
        if (role == null) return NotFound();

        // Check if there are users assigned to this role
        var usersWithRole = await _context.UserRoles.AnyAsync(ur => ur.RoleId == id);
        if (usersWithRole)
            return BadRequest(new { error = "Cannot delete role that is assigned to users" });

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();
        return Ok();
    }
}

public class RoleCreateUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class PermissionAssignmentDto
{
    public string PermissionName { get; set; } = string.Empty;
}
