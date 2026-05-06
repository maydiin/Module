using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Authorization;
using Module.Data;
using Module.Entities;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/visibility-rules")]
[Authorize]
public class ModuleVisibilityRulesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IAuditLogService _auditLogService;

    public ModuleVisibilityRulesController(AppDbContext context, ITenantService tenantService, IAuditLogService auditLogService)
    {
        _context = context;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    [HasModulePermission("Manage")]
    public async Task<IActionResult> GetRules(int moduleId)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var rules = await _context.ModuleVisibilityRules
            .Include(r => r.Role)
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId)
            .OrderBy(r => r.Id)
            .ToListAsync();
            
        var dtos = rules.Select(r => new VisibilityRuleDto
        {
            Id = r.Id,
            RoleId = r.RoleId,
            RoleName = r.Role?.Name,
            Field = r.Field,
            Operator = r.Operator,
            Value = r.Value,
            Action = r.Action,
            IsActive = r.IsActive
        });
        
        return Ok(dtos);
    }

    [HttpPost]
    [HasModulePermission("Manage")]
    public async Task<IActionResult> CreateRule(int moduleId, [FromBody] VisibilityRuleCreateUpdateDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var module = await _context.Modules.FirstOrDefaultAsync(m => m.Id == moduleId && m.TenantId == tenantId);
        if (module == null) return NotFound(new { error = "Module not found" });

        var rule = new ModuleVisibilityRule
        {
            ModuleId = moduleId,
            RoleId = dto.RoleId,
            Field = dto.Field,
            Operator = dto.Operator,
            Value = dto.Value,
            Action = dto.Action,
            IsActive = dto.IsActive,
            TenantId = tenantId
        };
        
        _context.ModuleVisibilityRules.Add(rule);
        await _context.SaveChangesAsync();
        
        await _auditLogService.LogAsync("Create", "VisibilityRule", rule.Id.ToString(), $"Rule on {module.Name}");
        
        return Ok(new { message = "Rule created successfully", id = rule.Id });
    }

    [HttpPut("{ruleId}")]
    [HasModulePermission("Manage")]
    public async Task<IActionResult> UpdateRule(int moduleId, int ruleId, [FromBody] VisibilityRuleCreateUpdateDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var rule = await _context.ModuleVisibilityRules
            .FirstOrDefaultAsync(r => r.Id == ruleId && r.ModuleId == moduleId && r.TenantId == tenantId);
        
        if (rule == null) return NotFound(new { error = "Rule not found" });

        rule.RoleId = dto.RoleId;
        rule.Field = dto.Field;
        rule.Operator = dto.Operator;
        rule.Value = dto.Value;
        rule.Action = dto.Action;
        rule.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        
        var module = await _context.Modules.FindAsync(moduleId);
        await _auditLogService.LogAsync("Update", "VisibilityRule", rule.Id.ToString(), $"Rule on {module?.Name}");
        
        return Ok(new { message = "Rule updated successfully" });
    }

    [HttpDelete("{ruleId}")]
    [HasModulePermission("Manage")]
    public async Task<IActionResult> DeleteRule(int moduleId, int ruleId)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var rule = await _context.ModuleVisibilityRules
            .FirstOrDefaultAsync(r => r.Id == ruleId && r.ModuleId == moduleId && r.TenantId == tenantId);
        
        if (rule == null) return NotFound(new { error = "Rule not found" });

        _context.ModuleVisibilityRules.Remove(rule);
        await _context.SaveChangesAsync();
        
        var module = await _context.Modules.FindAsync(moduleId);
        await _auditLogService.LogAsync("Delete", "VisibilityRule", rule.Id.ToString(), $"Rule on {module?.Name}");
        
        return NoContent();
    }
}

public class VisibilityRuleDto
{
    public int Id { get; set; }
    public int? RoleId { get; set; }
    public string? RoleName { get; set; }
    public string Field { get; set; } = string.Empty;
    public string Operator { get; set; } = "eq";
    public string Action { get; set; } = "Hide";
    public string Value { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class VisibilityRuleCreateUpdateDto
{
    public int? RoleId { get; set; }
    public string Field { get; set; } = string.Empty;
    public string Operator { get; set; } = "eq";
    public string Action { get; set; } = "Hide";
    public string Value { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
