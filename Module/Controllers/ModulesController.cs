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
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITenantService _tenantService;
    private readonly IAuditLogService _auditLogService;

    public ModulesController(IUnitOfWork unitOfWork, ITenantService tenantService, IAuditLogService auditLogService)
    {
        _unitOfWork = unitOfWork;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateModule([FromBody] CreateModuleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(ApiResponse<object>.Fail("Module name is required"));
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

        await _unitOfWork.Modules.AddAsync(module);
        await _unitOfWork.CompleteAsync();

        // Dynamically create permissions for the new module (tenant-scoped)
        var permissions = new[] { "View", "Create", "Update", "Delete", "Manage", "Api", "Script" };
        var createdPermissions = new List<Entities.Permission>();

        foreach (var action in permissions)
        {
            var permName = $"Module.{module.Name}.{action}";
            string description;

            if (action == "Manage")
                description = $"Can manage {module.Name} schema";
            else if (action == "Api")
                description = $"Can manage {module.Name} API integrations";
            else if (action == "Script")
                description = $"Can manage {module.Name} dynamic scripts";
            else
                description = $"Can {action.ToLower()} {module.Name} records";

            var permission = new Entities.Permission
            {
                Name = permName,
                Description = description,
                TenantId = tenantId
            };
            await _unitOfWork.Permissions.AddAsync(permission);
            createdPermissions.Add(permission);
        }

        await _unitOfWork.CompleteAsync();

        // Assign these permissions to the tenant's Admin role
        var adminRole = await _unitOfWork.Roles.AsQueryable().FirstOrDefaultAsync(r => r.Name == "Admin" && r.TenantId == tenantId);
        bool shouldRefreshToken = false;
        
        if (adminRole != null)
        {
            foreach (var perm in createdPermissions)
            {
                await _unitOfWork.RolePermissions.AddAsync(new Entities.RolePermission
                {
                    RoleId = adminRole.Id,
                    PermissionId = perm.Id
                });
            }
            await _unitOfWork.CompleteAsync();
            
            // Check if the current user has the Admin role
            var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            shouldRefreshToken = await _unitOfWork.UserRoles.AsQueryable().AnyAsync(ur => ur.UserId == currentUserId && ur.RoleId == adminRole.Id);
        }

        await _auditLogService.LogAsync("Create", "Module", module.Id.ToString(), module.Name);

        return CreatedAtAction(nameof(GetModule), new { id = module.Id }, ApiResponse<object>.Ok(new
        {
            id = module.Id,
            name = module.Name,
            shouldRefreshToken = shouldRefreshToken
        }));
    }

    [HttpGet]
    public async Task<IActionResult> ListModules()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var modules = await _unitOfWork.Modules.AsQueryable()
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

        return Ok(ApiResponse<IEnumerable<ModuleDto>>.Ok(modules));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetModule(int id)
    {
        var module = await _unitOfWork.Modules.GetByIdAsync(id);

        if (module == null)
        {
            return NotFound(ApiResponse<object>.Fail("Module not found"));
        }

        return Ok(ApiResponse<ModuleDto>.Ok(new ModuleDto
        {
            Id = module.Id,
            Name = module.Name,
            AuditCreate = module.AuditCreate,
            AuditUpdate = module.AuditUpdate,
            AuditDelete = module.AuditDelete
        }));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateModule(int id, [FromBody] UpdateModuleDto dto)
    {
        var module = await _unitOfWork.Modules.GetByIdAsync(id);
        if (module == null)
        {
            return NotFound(ApiResponse<object>.Fail("Module not found"));
        }

        // Check permission: Module.{Name}.Manage
        var permissionName = $"Module.{module.Name}.Manage";
        var hasPermission = User.HasClaim(c => c.Type == "Permission" && c.Value == permissionName) ||
                            User.IsInRole("Super Admin");

        if (!hasPermission)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var tenantId = _tenantService.GetCurrentTenantId();
            
            // Super Admin check again for safety
            var isSuperAdmin = await _unitOfWork.UserRoles.AsQueryable()
                .AnyAsync(ur => ur.UserId == userId && ur.Role.Name == "Super Admin");
                
            if (!isSuperAdmin)
            {
                var userPermissions = await _unitOfWork.UserRoles.AsQueryable()
                    .Where(ur => ur.UserId == userId)
                    .Join(_unitOfWork.RolePermissions.AsQueryable(), ur => ur.RoleId, rp => rp.RoleId, (ur, rp) => rp.PermissionId)
                    .Join(_unitOfWork.Permissions.AsQueryable().Where(p => p.TenantId == tenantId), pid => pid, p => p.Id, (pid, p) => p.Name)
                    .ToListAsync();
                    
                if (!userPermissions.Contains(permissionName))
                {
                    return Forbid();
                }
            }
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(ApiResponse<object>.Fail("Module name is required"));
        }

        // Handle Rename
        if (!string.Equals(module.Name, dto.Name, StringComparison.OrdinalIgnoreCase))
        {
            // Check if new name exists
            if (await _unitOfWork.Modules.AsQueryable().AnyAsync(m => m.Name == dto.Name && m.TenantId == module.TenantId))
            {
                return BadRequest(ApiResponse<object>.Fail("Module with this name already exists"));
            }

            var oldName = module.Name;
            var newName = dto.Name;

            // Rename permissions
            var permissions = await _unitOfWork.Permissions.AsQueryable()
                .Where(p => p.Name.StartsWith($"Module.{oldName}."))
                .ToListAsync();

            foreach (var perm in permissions)
            {
                perm.Name = perm.Name.Replace($"Module.{oldName}.", $"Module.{newName}.");
                perm.Description = perm.Description.Replace(oldName, newName);
                _unitOfWork.Permissions.Update(perm);
            }

            var relations = await _unitOfWork.RecordRelations.AsQueryable()
                .Where(r => r.TargetModule == oldName)
                .ToListAsync();
            
            foreach (var rel in relations)
            {
                rel.TargetModule = newName;
                _unitOfWork.RecordRelations.Update(rel);
            }
            
            module.Name = newName;
        }

        module.AuditCreate = dto.AuditCreate;
        module.AuditUpdate = dto.AuditUpdate;
        module.AuditDelete = dto.AuditDelete;

        _unitOfWork.Modules.Update(module);
        await _unitOfWork.CompleteAsync();
        
        await _auditLogService.LogAsync("Update", "Module", module.Id.ToString(), module.Name);

        return Ok(ApiResponse<ModuleDto>.Ok(new ModuleDto
        {
            Id = module.Id,
            Name = module.Name,
            AuditCreate = module.AuditCreate,
            AuditUpdate = module.AuditUpdate,
            AuditDelete = module.AuditDelete
        }));
    }
}
