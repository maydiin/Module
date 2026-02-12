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

    public ModulesController(AppDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
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
            TenantId = tenantId
        };

        _context.Modules.Add(module);
        await _context.SaveChangesAsync();

        // Dynamically create permissions for the new module (tenant-scoped)
        var permissions = new[] { "View", "Create", "Update", "Delete", "Manage" };
        var createdPermissions = new List<Entities.Permission>();

        foreach (var action in permissions)
        {
            var permName = $"Module.{module.Name}.{action}";
            var description = action == "Manage" 
                ? $"Can manage {module.Name} schema" 
                : $"Can {action.ToLower()} {module.Name} records";

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
                Name = m.Name
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
            Name = module.Name
        });
    }
}

