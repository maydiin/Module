using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/records")]
public class ModuleRecordsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly MediatR.IMediator _mediator;

    public ModuleRecordsController(AppDbContext context, IModuleService moduleService, IRelationService relationService, MediatR.IMediator mediator)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _mediator = mediator;
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
        var module = await _context.Modules.FindAsync(moduleId);
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

