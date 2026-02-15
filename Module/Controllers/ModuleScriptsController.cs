using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Authorization;
using Module.Data;
using Module.Entities;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/scripts")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class ModuleScriptsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;

    public ModuleScriptsController(AppDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    [HasModulePermission("Script")]
    public async Task<ActionResult<List<ModuleScript>>> GetScripts(int moduleId)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var scripts = await _context.ModuleScripts
            .Where(s => s.ModuleId == moduleId && s.TenantId == tenantId)
            .OrderBy(s => s.TriggerType)
            .ToListAsync();
            
        return Ok(scripts);
    }

    [HttpGet("{id}")]
    [HasModulePermission("Script")]
    public async Task<ActionResult<ModuleScript>> GetScript(int moduleId, int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var script = await _context.ModuleScripts
            .FirstOrDefaultAsync(s => s.Id == id && s.ModuleId == moduleId && s.TenantId == tenantId);

        if (script == null) return NotFound();

        return Ok(script);
    }

    [HttpPost]
    [HasModulePermission("Script")]
    public async Task<ActionResult<ModuleScript>> CreateScript(int moduleId, [FromBody] ModuleScriptDTO dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        // Ensure unique trigger per module/tenant
        var existing = await _context.ModuleScripts
            .FirstOrDefaultAsync(s => s.ModuleId == moduleId && s.TenantId == tenantId && s.TriggerType == dto.TriggerType);
            
        if (existing != null)
        {
            return BadRequest(new { error = $"Script for trigger '{dto.TriggerType}' already exists." });
        }
        
        var script = new ModuleScript
        {
            TenantId = tenantId,
            ModuleId = moduleId,
            TriggerType = dto.TriggerType,
            ScriptContent = dto.ScriptContent,
            IsActive = dto.IsActive
        };

        _context.ModuleScripts.Add(script);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetScript), new { moduleId, id = script.Id }, script);
    }

    [HttpPut("{id}")]
    [HasModulePermission("Script")]
    public async Task<IActionResult> UpdateScript(int moduleId, int id, [FromBody] ModuleScriptDTO dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();

        var script = await _context.ModuleScripts
            .FirstOrDefaultAsync(s => s.Id == id && s.ModuleId == moduleId && s.TenantId == tenantId);

        if (script == null) return NotFound();

        // Check uniqueness if trigger type changed
        if (script.TriggerType != dto.TriggerType)
        {
            var existing = await _context.ModuleScripts
                .FirstOrDefaultAsync(s => s.ModuleId == moduleId && s.TenantId == tenantId && s.TriggerType == dto.TriggerType);
            if (existing != null)
            {
                return BadRequest(new { error = $"Script for trigger '{dto.TriggerType}' already exists." });
            }
        }

        script.TriggerType = dto.TriggerType;
        script.ScriptContent = dto.ScriptContent;
        script.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    [HasModulePermission("Script")]
    public async Task<IActionResult> DeleteScript(int moduleId, int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();

        var script = await _context.ModuleScripts
            .FirstOrDefaultAsync(s => s.Id == id && s.ModuleId == moduleId && s.TenantId == tenantId);

        if (script == null) return NotFound();

        _context.ModuleScripts.Remove(script);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class ModuleScriptDTO
{
    public string TriggerType { get; set; } = string.Empty;
    public string ScriptContent { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
