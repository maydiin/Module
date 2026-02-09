using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Services;
using Module.FieldTypes;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/records")]
public class ModuleRecordsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly MediatR.IMediator _mediator;
    private readonly FieldTypeFactory _fieldTypeFactory;

    public ModuleRecordsController(AppDbContext context, IModuleService moduleService, IRelationService relationService, MediatR.IMediator mediator, FieldTypeFactory fieldTypeFactory)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _mediator = mediator;
        _fieldTypeFactory = fieldTypeFactory;
    }

    [HttpPost]
    public async Task<ActionResult<ModuleRecordDto>> CreateRecord(int moduleId, [FromBody] CreateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        try 
        {
            var result = await _mediator.Send(new Features.Records.Commands.CreateRecordCommand(moduleId, dto.Data));
            return CreatedAtAction(nameof(GetRecord), new { moduleId, recordId = result.Id }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            // In a real app, logic inside the handler would throw specific validation exceptions
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ModuleRecordDto>>> ListRecords(int moduleId)
    {
        var module = await _context.Modules
            .Include(m => m.Fields)
            .FirstOrDefaultAsync(m => m.Id == moduleId);
            
        if (module == null)
        {
            return NotFound(new { error = "Module not found" });
        }

        var records = await _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var recordIds = records.Select(r => r.Id).ToList();
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == module.Name && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count);

        var recordDtos = records.Select(r =>
        {
            var data = _moduleService.DeserializeData(r.Data);
            
            // Compute non-stored formula fields at runtime
            // Ordered by OrderNo to ensure dependencies are calculated first
            foreach (var field in module.Fields.OrderBy(f => f.OrderNo))
            {
                if (field.Type == "formula")
                {
                    try
                    {
                        // If it's not stored, we MUST calculate it
                        // If it IS stored, it might depend on a non-stored field, so we might need to recalculate or just ensure dependencies exist?
                        // Simple approach: Always calculate non-stored fields. 
                        // Stored fields are already in 'data'. 
                        // BUT if a stored field depends on a non-stored field, the non-stored field needs to be in 'data' first.
                        
                        if (!field.IsStored) 
                        {
                            var fieldType = _fieldTypeFactory.Get(field.Type);
                            var computedValue = fieldType.Compute(field, data);
                            if (computedValue != null)
                            {
                                data[field.Name] = computedValue;
                            }
                        }
                        
                        // If a stored field depends on a non-stored field, we might need to recalculate it locally for display purposes if the DB value is stale/wrong?
                        // For now, let's assume stored fields are correct in DB, but if they depend on non-stored fields, those non-stored fields are needed for display regardless.
                    }
                    catch (ArgumentException)
                    {
                        // Field type not supported, ignore
                    }
                }
            }
            
            return new ModuleRecordDto
            {
                Id = r.Id,
                ModuleId = r.ModuleId,
                Data = data,
                LinkedCount = counts.GetValueOrDefault(r.Id, 0),
                CreatedAt = r.CreatedAt
            };
        }).ToList();

        return Ok(recordDtos);
    }

    [HttpGet("{recordId}")]
    public async Task<ActionResult<ModuleRecordDto>> GetRecord(int moduleId, int recordId)
    {
        var record = await _context.ModuleRecords
            .Include(r => r.Module)
            .FirstOrDefaultAsync(r => r.Id == recordId && r.ModuleId == moduleId);

        if (record == null)
        {
            return NotFound();
        }

        var count = await _context.RecordRelations
            .CountAsync(r => r.TargetModule == record.Module.Name && r.TargetRecordId == record.Id);

        return Ok(new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = _moduleService.DeserializeData(record.Data),
            LinkedCount = count,
            CreatedAt = record.CreatedAt
        });
    }

    [HttpPut("{recordId}")]
    public async Task<ActionResult<ModuleRecordDto>> UpdateRecord(int moduleId, int recordId, [FromBody] UpdateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        try
        {
            var result = await _mediator.Send(new Features.Records.Commands.UpdateRecordCommand(moduleId, recordId, dto.Data));
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{recordId}")]
    public async Task<IActionResult> DeleteRecord(int moduleId, int recordId)
    {
        try
        {
            await _mediator.Send(new Features.Records.Commands.DeleteRecordCommand(moduleId, recordId));
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
             return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("/api/records/by-name/{moduleName}")]
    public async Task<ActionResult<IEnumerable<ModuleRecordDto>>> ListRecordsByName(string moduleName)
    {
        var module = await _context.Modules.FirstOrDefaultAsync(m => m.Name == moduleName);
        if (module == null)
        {
            return NotFound(new { error = $"Module '{moduleName}' not found" });
        }

        var records = await _context.ModuleRecords
            .Where(r => r.ModuleId == module.Id)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var recordIds = records.Select(r => r.Id).ToList();
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == moduleName && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count);

        var recordDtos = records.Select(r => new ModuleRecordDto
        {
            Id = r.Id,
            ModuleId = r.ModuleId,
            Data = _moduleService.DeserializeData(r.Data),
            LinkedCount = counts.GetValueOrDefault(r.Id, 0),
            CreatedAt = r.CreatedAt
        }).ToList();

        return Ok(recordDtos);
    }
}

