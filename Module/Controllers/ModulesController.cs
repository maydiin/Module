using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;

namespace Module.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ModulesController : ControllerBase
{
    private readonly AppDbContext _context;

    public ModulesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<ActionResult<ModuleDto>> CreateModule([FromBody] CreateModuleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { error = "Module name is required" });
        }

        var module = new Entities.Module
        {
            Name = dto.Name
        };

        _context.Modules.Add(module);
        await _context.SaveChangesAsync();

        // Dynamically create permissions for the new module
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
                Description = description
            };
            _context.Permissions.Add(permission);
            createdPermissions.Add(permission);
        }

        await _context.SaveChangesAsync();

        // Assign these permissions to the Admin role
        var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Admin");
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
        }

        return CreatedAtAction(nameof(GetModule), new { id = module.Id }, new ModuleDto
        {
            Id = module.Id,
            Name = module.Name
        });
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ModuleDto>>> ListModules()
    {
        var modules = await _context.Modules
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

