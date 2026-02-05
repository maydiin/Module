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

    public ModuleRecordsController(AppDbContext context, IModuleService moduleService, IRelationService relationService)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
    }

    [HttpPost]
    public async Task<ActionResult<ModuleRecordDto>> CreateRecord(int moduleId, [FromBody] CreateModuleRecordDto dto)
    {
        var module = await _context.Modules.FindAsync(moduleId);
        if (module == null)
        {
            return NotFound(new { error = "Module not found" });
        }

        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        var errors = await _moduleService.ValidateDataAsync(moduleId, dto.Data);
        if (errors.Any())
        {
            return BadRequest(new { errors });
        }

        var jsonData = _moduleService.SerializeData(dto.Data);

        var record = new Entities.ModuleRecord
        {
            ModuleId = moduleId,
            Data = jsonData,
            CreatedAt = DateTime.UtcNow
        };

        _context.ModuleRecords.Add(record);
        await _context.SaveChangesAsync();

        // Save relations
        await _relationService.SaveRelations(module.Name, record.Id, record);

        return CreatedAtAction(nameof(GetRecord), new { moduleId, recordId = record.Id }, new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = dto.Data,
            CreatedAt = record.CreatedAt
        });
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
        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == recordId && r.ModuleId == moduleId);

        if (record == null)
        {
            return NotFound();
        }

        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        var errors = await _moduleService.ValidateDataAsync(moduleId, dto.Data);
        if (errors.Any())
        {
            return BadRequest(new { errors });
        }

        record.Data = _moduleService.SerializeData(dto.Data);
        await _context.SaveChangesAsync();

        // Update relations
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null)
        {
            await _relationService.SaveRelations(module.Name, record.Id, record);
        }

        var count = await _context.RecordRelations
            .CountAsync(r => r.TargetModule == module.Name && r.TargetRecordId == record.Id);

        return Ok(new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = dto.Data,
            LinkedCount = module != null ? count : 0,
            CreatedAt = record.CreatedAt
        });
    }

    [HttpDelete("{recordId}")]
    public async Task<IActionResult> DeleteRecord(int moduleId, int recordId)
    {
        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == recordId && r.ModuleId == moduleId);

        if (record == null)
        {
            return NotFound();
        }

        _context.ModuleRecords.Remove(record);
        await _context.SaveChangesAsync();

        // Delete relations for source
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null)
        {
            await _relationService.DeleteRelationsForSource(module.Name, record.Id);
        }

        return NoContent();
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

