using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.FieldTypes;
using Module.Authorization;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/fields")]
public class ModuleFieldsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly FieldTypeFactory _fieldTypeFactory;

    public ModuleFieldsController(AppDbContext context, FieldTypeFactory fieldTypeFactory)
    {
        _context = context;
        _fieldTypeFactory = fieldTypeFactory;
    }

    [HttpPost]
    [HasModulePermission("Manage")]
    public async Task<ActionResult<ModuleFieldDto>> AddField(int moduleId, [FromBody] CreateModuleFieldDto dto)
    {
        var module = await _context.Modules.FindAsync(moduleId);
        if (module == null)
        {
            return NotFound(new { error = "Module not found" });
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { error = "Field name is required" });
        }

        if (string.IsNullOrWhiteSpace(dto.Type))
        {
            return BadRequest(new { error = "Field type is required" });
        }

        var validTypes = _fieldTypeFactory.GetSupportedTypes();
        if (!validTypes.Contains(dto.Type.ToLower()))
        {
            return BadRequest(new { error = $"Field type must be one of: {string.Join(", ", validTypes)}" });
        }

        var existingField = await _context.ModuleFields
            .FirstOrDefaultAsync(f => f.ModuleId == moduleId && f.Name == dto.Name);

        if (existingField != null)
        {
            return Conflict(new { error = "Field with this name already exists" });
        }

        var field = new Entities.ModuleField
        {
            ModuleId = moduleId,
            Name = dto.Name,
            Label = dto.Label ?? dto.Name,
            Type = dto.Type.ToLower(),
            Required = dto.Required,
            Options = dto.Options,
            OrderNo = dto.OrderNo
        };

        _context.ModuleFields.Add(field);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetField), new { moduleId, id = field.Id }, new ModuleFieldDto
        {
            Id = field.Id,
            ModuleId = field.ModuleId,
            Name = field.Name,
            Label = field.Label,
            Type = field.Type,
            Required = field.Required,
            Options = field.Options,
            OrderNo = field.OrderNo
        });
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ModuleFieldDto>>> ListFields(int moduleId)
    {
        var module = await _context.Modules.FindAsync(moduleId);
        if (module == null)
        {
            return NotFound(new { error = "Module not found" });
        }

        var fields = await _context.ModuleFields
            .Where(f => f.ModuleId == moduleId)
            .OrderBy(f => f.OrderNo)
            .ThenBy(f => f.Name)
            .Select(f => new ModuleFieldDto
            {
                Id = f.Id,
                ModuleId = f.ModuleId,
                Name = f.Name,
                Label = f.Label,
                Type = f.Type,
                Required = f.Required,
                Options = f.Options,
                OrderNo = f.OrderNo
            })
            .ToListAsync();

        return Ok(fields);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ModuleFieldDto>> GetField(int moduleId, int id)
    {
        var field = await _context.ModuleFields
            .FirstOrDefaultAsync(f => f.Id == id && f.ModuleId == moduleId);

        if (field == null)
        {
            return NotFound();
        }

        return Ok(new ModuleFieldDto
        {
            Id = field.Id,
            ModuleId = field.ModuleId,
            Name = field.Name,
            Label = field.Label,
            Type = field.Type,
            Required = field.Required,
            Options = field.Options,
            OrderNo = field.OrderNo
        });
    }

    [HttpGet("types")]
    public ActionResult<IEnumerable<string>> GetSupportedTypes()
    {
        return Ok(_fieldTypeFactory.GetSupportedTypes());
    }
}

