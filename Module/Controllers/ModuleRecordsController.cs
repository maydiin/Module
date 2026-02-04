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

    public ModuleRecordsController(AppDbContext context, IModuleService moduleService)
    {
        _context = context;
        _moduleService = moduleService;
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

        var recordDtos = records.Select(r => new ModuleRecordDto
        {
            Id = r.Id,
            ModuleId = r.ModuleId,
            Data = _moduleService.DeserializeData(r.Data),
            CreatedAt = r.CreatedAt
        }).ToList();

        return Ok(recordDtos);
    }

    [HttpGet("{recordId}")]
    public async Task<ActionResult<ModuleRecordDto>> GetRecord(int moduleId, int recordId)
    {
        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == recordId && r.ModuleId == moduleId);

        if (record == null)
        {
            return NotFound();
        }

        return Ok(new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = _moduleService.DeserializeData(record.Data),
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

        return Ok(new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = dto.Data,
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

        var recordDtos = records.Select(r => new ModuleRecordDto
        {
            Id = r.Id,
            ModuleId = r.ModuleId,
            Data = _moduleService.DeserializeData(r.Data),
            CreatedAt = r.CreatedAt
        }).ToList();

        return Ok(recordDtos);
    }
}

