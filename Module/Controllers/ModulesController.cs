using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Services;
using Module.Services.Caching;

namespace Module.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ModulesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IAuditLogService _auditLogService;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly IModuleCacheService _moduleCacheService;

    public ModulesController(
        AppDbContext context,
        ITenantService tenantService,
        IAuditLogService auditLogService,
        IModuleService moduleService,
        IRelationService relationService,
        IModuleCacheService moduleCacheService)
    {
        _context = context;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
        _moduleService = moduleService;
        _relationService = relationService;
        _moduleCacheService = moduleCacheService;
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
            AuditDelete = dto.AuditDelete,
            KanbanField = dto.KanbanField,
            LayoutConfig = dto.LayoutConfig
        };

        _context.Modules.Add(module);
        await _context.SaveChangesAsync();

        // Dynamically create permissions for the new module (tenant-scoped)
        var permissionActions = new[] { "View", "Create", "Update", "Delete", "Manage", "Api", "Script" };
        var createdPermissions = new List<Entities.Permission>();

        foreach (var action in permissionActions)
        {
            var permName = $"Module.{module.Name}.{action}";
            string description = action switch
            {
                "Manage" => $"Can manage {module.Name} schema",
                "Api" => $"Can manage {module.Name} API integrations",
                "Script" => $"Can manage {module.Name} dynamic scripts",
                _ => $"Can {action.ToLower()} {module.Name} records"
            };

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

        var modules = await _context.Modules
            .Where(m => m.TenantId == tenantId)
            .OrderBy(m => m.Name)
            .Select(m => new ModuleDto
            {
                Id = m.Id,
                Name = m.Name,
                AuditCreate = m.AuditCreate,
                AuditUpdate = m.AuditUpdate,
                AuditDelete = m.AuditDelete,
                KanbanField = m.KanbanField,
                LayoutConfig = m.LayoutConfig
            })
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<ModuleDto>>.Ok(modules));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetModule(int id)
    {
        var module = await _context.Modules.FindAsync(id);

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
            AuditDelete = module.AuditDelete,
            KanbanField = module.KanbanField,
            LayoutConfig = module.LayoutConfig
        }));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateModule(int id, [FromBody] UpdateModuleDto dto)
    {
        var module = await _context.Modules.FindAsync(id);
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

            var isSuperAdmin = await _context.UserRoles
                .AnyAsync(ur => ur.UserId == userId && ur.Role.Name == "Super Admin");

            if (!isSuperAdmin)
            {
                var userPermissions = await _context.UserRoles
                    .Where(ur => ur.UserId == userId)
                    .Join(_context.RolePermissions, ur => ur.RoleId, rp => rp.RoleId, (ur, rp) => rp.PermissionId)
                    .Join(_context.Permissions.Where(p => p.TenantId == tenantId), pid => pid, p => p.Id, (pid, p) => p.Name)
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

        var oldName = module.Name;

        // Handle Rename
        if (!string.Equals(module.Name, dto.Name, StringComparison.OrdinalIgnoreCase))
        {
            if (await _context.Modules.AnyAsync(m => m.Name == dto.Name && m.TenantId == module.TenantId))
            {
                return BadRequest(ApiResponse<object>.Fail("Module with this name already exists"));
            }

            var newName = dto.Name;

            // Rename permissions (EF change tracking handles the update)
            var permissions = await _context.Permissions
                .Where(p => p.Name.StartsWith($"Module.{oldName}."))
                .ToListAsync();

            foreach (var perm in permissions)
            {
                perm.Name = perm.Name.Replace($"Module.{oldName}.", $"Module.{newName}.");
                perm.Description = perm.Description.Replace(oldName, newName);
            }

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
        module.KanbanField = dto.KanbanField;
        module.LayoutConfig = dto.LayoutConfig;

        await _context.SaveChangesAsync();

        _moduleCacheService.InvalidateModule(module.Id, oldName, module.TenantId);
        if (oldName != dto.Name)
        {
            _moduleCacheService.InvalidateModule(module.Id, dto.Name, module.TenantId);
        }

        await _auditLogService.LogAsync("Update", "Module", module.Id.ToString(), module.Name);

        return Ok(ApiResponse<ModuleDto>.Ok(new ModuleDto
        {
            Id = module.Id,
            Name = module.Name,
            AuditCreate = module.AuditCreate,
            AuditUpdate = module.AuditUpdate,
            AuditDelete = module.AuditDelete,
            KanbanField = module.KanbanField,
            LayoutConfig = module.LayoutConfig
        }));
    }

    [HttpGet("summaries")]
    public async Task<IActionResult> GetModuleSummaries()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var modules = await _context.Modules
            .Include(m => m.Fields)
            .Where(m => m.TenantId == tenantId)
            .OrderBy(m => m.Name)
            .ToListAsync();

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized();
        }

        var isSuperAdmin = _tenantService.IsSuperAdmin();
        
        // Fetch all permissions for the current user once to avoid multiple DB calls in the loop
        var userPermissions = isSuperAdmin ? new List<string>() : await _context.UserRoles
            .Where(ur => ur.UserId == userId)
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Name)
            .Distinct()
            .ToListAsync();

        var summaries = new List<ModuleSummaryDto>();

        foreach (var module in modules)
        {
            // Simple permission check: if user has any Module.{Name}.* permission OR is Super Admin
            var permissionPrefix = $"Module.{module.Name}.";
            var hasViewPermission = isSuperAdmin || userPermissions.Any(p => p.StartsWith(permissionPrefix));

            if (!hasViewPermission) continue;

            var latestRecords = await _context.ModuleRecords
                .Where(r => r.ModuleId == module.Id && r.TenantId == tenantId)
                .OrderByDescending(r => r.CreatedAt)
                .Take(5)
                .ToListAsync();

            var recordsData = latestRecords.Select(r => _moduleService.DeserializeData(r.Data)).ToList();
            await _relationService.EnrichWithDisplayValuesAsync(module, recordsData);

            var recordDtos = latestRecords.Select((r, i) =>
            {
                var data = recordsData[i];
                
                _moduleService.ComputeFormulas(module, data);

                return new ModuleRecordDto
                {
                    Id = r.Id,
                    ModuleId = r.ModuleId,
                    Data = data,
                    CreatedAt = r.CreatedAt
                };
            }).ToList();

            summaries.Add(new ModuleSummaryDto
            {
                ModuleId = module.Id,
                ModuleName = module.Name,
                KanbanField = module.KanbanField,
                LayoutConfig = module.LayoutConfig,
                AuditCreate = module.AuditCreate,
                AuditUpdate = module.AuditUpdate,
                AuditDelete = module.AuditDelete,
                Fields = module.Fields.Select(f => new ModuleFieldDto
                {
                    Id = f.Id,
                    ModuleId = f.ModuleId,
                    Name = f.Name,
                    Label = f.Label,
                    Type = f.Type,
                    IsDisplayField = f.IsDisplayField,
                    OrderNo = f.OrderNo
                }).OrderBy(f => f.OrderNo).ToList(),
                LatestRecords = recordDtos
            });
        }

        return Ok(ApiResponse<List<ModuleSummaryDto>>.Ok(summaries));
    }

}
