using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Entities;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/api-configs")]
public class ExternalApiConfigsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ExternalApiConfigsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExternalApiConfigDto>>> GetConfigs(int moduleId)
    {
        var configs = await _context.ExternalApiConfigs
            .Where(c => c.ModuleId == moduleId)
            .ToListAsync();

        return Ok(configs.Select(c => new ExternalApiConfigDto
        {
            Id = c.Id,
            ModuleId = c.ModuleId,
            Name = c.Name,
            Url = c.Url,
            Method = c.Method,
            HeadersJson = c.HeadersJson,
            RequestBodyTemplate = c.RequestBodyTemplate,
            ResponseMappingsJson = c.ResponseMappingsJson
        }));
    }

    [HttpPost]
    public async Task<ActionResult<ExternalApiConfigDto>> CreateConfig(int moduleId, [FromBody] CreateExternalApiConfigDto dto)
    {
        var moduleExists = await _context.Modules.AnyAsync(m => m.Id == moduleId);
        if (!moduleExists) return NotFound(new { error = "Module not found" });

        var config = new ExternalApiConfig
        {
            ModuleId = moduleId,
            Name = dto.Name,
            Url = dto.Url,
            Method = dto.Method,
            HeadersJson = dto.HeadersJson,
            RequestBodyTemplate = dto.RequestBodyTemplate,
            ResponseMappingsJson = dto.ResponseMappingsJson
        };

        _context.ExternalApiConfigs.Add(config);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetConfigs), new { moduleId }, new ExternalApiConfigDto
        {
            Id = config.Id,
            ModuleId = config.ModuleId,
            Name = config.Name,
            Url = config.Url,
            Method = config.Method,
            HeadersJson = config.HeadersJson,
            RequestBodyTemplate = config.RequestBodyTemplate,
            ResponseMappingsJson = config.ResponseMappingsJson
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExternalApiConfigDto>> GetConfig(int moduleId, int id)
    {
        var config = await _context.ExternalApiConfigs
            .FirstOrDefaultAsync(c => c.Id == id && c.ModuleId == moduleId);

        if (config == null) return NotFound();

        return Ok(new ExternalApiConfigDto
        {
            Id = config.Id,
            ModuleId = config.ModuleId,
            Name = config.Name,
            Url = config.Url,
            Method = config.Method,
            HeadersJson = config.HeadersJson,
            RequestBodyTemplate = config.RequestBodyTemplate,
            ResponseMappingsJson = config.ResponseMappingsJson
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ExternalApiConfigDto>> UpdateConfig(int moduleId, int id, [FromBody] UpdateExternalApiConfigDto dto)
    {
        var config = await _context.ExternalApiConfigs
            .FirstOrDefaultAsync(c => c.Id == id && c.ModuleId == moduleId);

        if (config == null) return NotFound();

        config.Name = dto.Name;
        config.Url = dto.Url;
        config.Method = dto.Method;
        config.HeadersJson = dto.HeadersJson;
        config.RequestBodyTemplate = dto.RequestBodyTemplate;
        config.ResponseMappingsJson = dto.ResponseMappingsJson;

        await _context.SaveChangesAsync();

        return Ok(new ExternalApiConfigDto
        {
            Id = config.Id,
            ModuleId = config.ModuleId,
            Name = config.Name,
            Url = config.Url,
            Method = config.Method,
            HeadersJson = config.HeadersJson,
            RequestBodyTemplate = config.RequestBodyTemplate,
            ResponseMappingsJson = config.ResponseMappingsJson
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteConfig(int moduleId, int id)
    {
        var config = await _context.ExternalApiConfigs
            .FirstOrDefaultAsync(c => c.Id == id && c.ModuleId == moduleId);

        if (config == null) return NotFound();

        _context.ExternalApiConfigs.Remove(config);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
