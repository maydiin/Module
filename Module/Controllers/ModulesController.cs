using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ModulesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IAuditLogService _auditLogService;

    public ModulesController(AppDbContext context, ITenantService tenantService, IAuditLogService auditLogService)
    {
        _context = context;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
    }

    [HttpPost]
    public async Task<ActionResult<ModuleDto>> CreateModule([FromBody] CreateModuleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { error = "Module name is required" });
        }

        var tenantId = _tenantService.GetCurrentTenantId();

        var module = new Entities.Module
        {
            Name = dto.Name,
            TenantId = tenantId,
            AuditCreate = dto.AuditCreate,
            AuditUpdate = dto.AuditUpdate,
            AuditDelete = dto.AuditDelete
        };

        _context.Modules.Add(module);
        await _context.SaveChangesAsync();

        // Dynamically create permissions for the new module (tenant-scoped)
        var permissions = new[] { "View", "Create", "Update", "Delete", "Manage", "Api" };
        var createdPermissions = new List<Entities.Permission>();

        foreach (var action in permissions)
        {
            var permName = $"Module.{module.Name}.{action}";
            string description;

            if (action == "Manage")
                description = $"Can manage {module.Name} schema";
            else if (action == "Api")
                description = $"Can manage {module.Name} API integrations";
            else
                description = $"Can {action.ToLower()} {module.Name} records";

            var permission = new Entities.Permission
            {
                Name = permName,
                Description = description,
                TenantId = tenantId
            };
            _context.Permissions.Add(permission);
            createdPermissions.Add(permission);
        }

        await _context.SaveChangesAsync();

        // Assign these permissions to the tenant's Admin role
        var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Admin" && r.TenantId == tenantId);
        bool shouldRefreshToken = false;
        
        if (adminRole != null)
        {
            foreach (var perm in createdPermissions)
            {
                _context.RolePermissions.Add(new Entities.RolePermission
                {
                    RoleId = adminRole.Id,
                    PermissionId = perm.Id
                });
            }
            await _context.SaveChangesAsync();
            
            // Check if the current user has the Admin role
            var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            shouldRefreshToken = await _context.UserRoles.AnyAsync(ur => ur.UserId == currentUserId && ur.RoleId == adminRole.Id);
        }

        await _auditLogService.LogAsync("Create", "Module", module.Id.ToString(), module.Name);

        return CreatedAtAction(nameof(GetModule), new { id = module.Id }, new
        {
            id = module.Id,
            name = module.Name,
            shouldRefreshToken = shouldRefreshToken
        });
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ModuleDto>>> ListModules()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var modules = await _context.Modules
            .Where(m => m.TenantId == tenantId)
            .OrderBy(m => m.Name)
            .Select(m => new ModuleDto
            {
                Id = m.Id,
                Name = m.Name,
                AuditCreate = m.AuditCreate,
                AuditUpdate = m.AuditUpdate,
                AuditDelete = m.AuditDelete
            })
            .ToListAsync();

        return Ok(modules);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ModuleDto>> GetModule(int id)
    {
        var module = await _context.Modules.FindAsync(id);

        if (module == null)
        {
            return NotFound();
        }

        return Ok(new ModuleDto
        {
            Id = module.Id,
            Name = module.Name,
            AuditCreate = module.AuditCreate,
            AuditUpdate = module.AuditUpdate,
            AuditDelete = module.AuditDelete
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateModule(int id, [FromBody] UpdateModuleDto dto)
    {
        var module = await _context.Modules.FindAsync(id);
        if (module == null)
        {
            return NotFound();
        }

        // Check permission: Module.{Name}.Manage
        var permissionName = $"Module.{module.Name}.Manage";
        var hasPermission = User.HasClaim(c => c.Type == "Permission" && c.Value == permissionName) ||
                            User.IsInRole("Super Admin");

        if (!hasPermission)
        {
            // Also check if user is a tenant admin with this permission assigned via role
            // The policy/attribute based authorization might have already handled this if we used [HasModulePermission]
            // but since the module name is dynamic, we need to check manually or use a custom requirement.
            // For now, let's rely on the manual check logic consistent with other controllers or use the auth service if available.
            // Assuming the claims are populated correctly on login/refresh.
            
            // Re-verify against DB to be sure (since claims might be old)
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var tenantId = _tenantService.GetCurrentTenantId();
            
            // Super Admin check again for safety
            var isSuperAdmin = await _context.UserRoles
                .AnyAsync(ur => ur.UserId == userId && ur.Role.Name == "Super Admin");
                
            if (!isSuperAdmin)
            {
                var userPermissions = await _context.Database
                    .SqlQueryRaw<string>(@"
                        SELECT p.Name 
                        FROM Permissions p
                        JOIN RolePermissions rp ON p.Id = rp.PermissionId
                        JOIN UserRoles ur ON rp.RoleId = ur.RoleId
                        WHERE ur.UserId = {0} AND p.TenantId = {1}", userId, tenantId)
                    .ToListAsync();
                    
                if (!userPermissions.Contains(permissionName))
                {
                    return Forbid();
                }
            }
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { error = "Module name is required" });
        }

        // Handle Rename
        if (!string.Equals(module.Name, dto.Name, StringComparison.OrdinalIgnoreCase))
        {
            // Check if new name exists
            if (await _context.Modules.AnyAsync(m => m.Name == dto.Name && m.TenantId == module.TenantId))
            {
                return BadRequest(new { error = "Module with this name already exists" });
            }

            var oldName = module.Name;
            var newName = dto.Name;

            // Rename permissions
            var permissions = await _context.Permissions
                .Where(p => p.Name.StartsWith($"Module.{oldName}."))
                .ToListAsync();

            foreach (var perm in permissions)
            {
                perm.Name = perm.Name.Replace($"Module.{oldName}.", $"Module.{newName}.");
                perm.Description = perm.Description.Replace(oldName, newName);
            }

            // Also need to update RecordRelations targetModuleName if applicable?
            // Existing data might rely on module name strings.
            // Check ModuleRecordsController uses 'TargetModule' string in RecordRelations.
            // Yes, RecordRelation has TargetModule (string).
            var relations = await _context.RecordRelations
                .Where(r => r.TargetModule == oldName)
                .ToListAsync();
            
            foreach (var rel in relations)
            {
                rel.TargetModule = newName;
            }
            
            module.Name = newName;
        }

        module.AuditCreate = dto.AuditCreate;
        module.AuditUpdate = dto.AuditUpdate;
        module.AuditDelete = dto.AuditDelete;

        await _context.SaveChangesAsync();
        await _auditLogService.LogAsync("Update", "Module", module.Id.ToString(), module.Name);

        return Ok(new ModuleDto
        {
            Id = module.Id,
            Name = module.Name,
            AuditCreate = module.AuditCreate,
            AuditUpdate = module.AuditUpdate,
            AuditDelete = module.AuditDelete
        });
    }
}

