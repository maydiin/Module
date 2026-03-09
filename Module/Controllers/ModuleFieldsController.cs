using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.FieldTypes;
using Module.Authorization;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/fields")]
public class ModuleFieldsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly FieldTypeFactory _fieldTypeFactory;
    private readonly IAuditLogService _auditLogService;

    public ModuleFieldsController(AppDbContext context, FieldTypeFactory fieldTypeFactory, IAuditLogService auditLogService)
    {
        _context = context;
        _fieldTypeFactory = fieldTypeFactory;
        _auditLogService = auditLogService;
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
            OrderNo = dto.OrderNo,
            IsDisplayField = dto.IsDisplayField
        };

        _context.ModuleFields.Add(field);
        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync("Create", "Field", field.Id.ToString(), $"{field.Label} ({field.Name})");

        return CreatedAtAction(nameof(GetField), new { moduleId, id = field.Id }, new ModuleFieldDto
        {
            Id = field.Id,
            ModuleId = field.ModuleId,
            Name = field.Name,
            Label = field.Label,
            Type = field.Type,
            Required = field.Required,
            Options = field.Options,
            OrderNo = field.OrderNo,
            IsDisplayField = field.IsDisplayField
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
                OrderNo = f.OrderNo,
                IsDisplayField = f.IsDisplayField
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
            OrderNo = field.OrderNo,
            IsDisplayField = field.IsDisplayField
        });
    }

    [HttpPut("{id}")]
    [HasModulePermission("Manage")]
    public async Task<ActionResult<ModuleFieldDto>> UpdateField(int moduleId, int id, [FromBody] UpdateModuleFieldDto dto)
    {
        var field = await _context.ModuleFields
            .FirstOrDefaultAsync(f => f.Id == id && f.ModuleId == moduleId);

        if (field == null)
        {
            return NotFound(new { error = "Field not found" });
        }

        field.Label = string.IsNullOrWhiteSpace(dto.Label) ? field.Name : dto.Label;
        field.Required = dto.Required;
        field.Options = dto.Options;
        field.OrderNo = dto.OrderNo;
        field.IsDisplayField = dto.IsDisplayField;

        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync("Update", "Field", field.Id.ToString(), $"{field.Label} ({field.Name})");

        return Ok(new ModuleFieldDto
        {
            Id = field.Id,
            ModuleId = field.ModuleId,
            Name = field.Name,
            Label = field.Label,
            Type = field.Type,
            Required = field.Required,
            Options = field.Options,
            OrderNo = field.OrderNo,
            IsDisplayField = field.IsDisplayField
        });
    }

    [HttpGet("types")]
    public ActionResult<IEnumerable<string>> GetSupportedTypes()
    {
        return Ok(_fieldTypeFactory.GetSupportedTypes());
    }
}

