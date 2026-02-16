using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Authorization;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/reports")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class ModuleReportsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;

    private readonly IReportService _reportService;

    public ModuleReportsController(AppDbContext context, ITenantService tenantService, IReportService reportService)
    {
        _context = context;
        _tenantService = tenantService;
        _reportService = reportService;
    }

    [HttpGet]
    [HasModulePermission("View")]
    public async Task<ActionResult<IEnumerable<ModuleReportDto>>> GetReports(int moduleId)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var reports = await _context.ModuleReports
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId)
            .OrderBy(r => r.Name)
            .Select(r => new ModuleReportDto
            {
                Id = r.Id,
                ModuleId = r.ModuleId,
                Name = r.Name,
                Type = r.Type,
                Configuration = r.Configuration,
                IsActive = r.IsActive,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        return Ok(reports);
    }

    [HttpGet("{id}")]
    [HasModulePermission("View")]
    public async Task<ActionResult<ModuleReportDto>> GetReport(int moduleId, int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var report = await _context.ModuleReports
            .FirstOrDefaultAsync(r => r.Id == id && r.ModuleId == moduleId && r.TenantId == tenantId);

        if (report == null) return NotFound();

        return Ok(new ModuleReportDto
        {
            Id = report.Id,
            ModuleId = report.ModuleId,
            Name = report.Name,
            Type = report.Type,
            Configuration = report.Configuration,
            IsActive = report.IsActive,
            CreatedAt = report.CreatedAt
        });
    }

    [HttpPost]
    [HasModulePermission("Update")] // Usually, users who can configure the module can create reports
    public async Task<ActionResult<ModuleReportDto>> CreateReport(int moduleId, CreateModuleReportDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var report = new ModuleReport
        {
            ModuleId = moduleId,
            TenantId = tenantId,
            Name = dto.Name,
            Type = dto.Type,
            Configuration = dto.Configuration,
            IsActive = dto.IsActive
        };

        _context.ModuleReports.Add(report);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetReport), new { moduleId, id = report.Id }, new ModuleReportDto
        {
            Id = report.Id,
            ModuleId = report.ModuleId,
            Name = report.Name,
            Type = report.Type,
            Configuration = report.Configuration,
            IsActive = report.IsActive,
            CreatedAt = report.CreatedAt
        });
    }

    [HttpPut("{id}")]
    [HasModulePermission("Update")]
    public async Task<IActionResult> UpdateReport(int moduleId, int id, UpdateModuleReportDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var report = await _context.ModuleReports
            .FirstOrDefaultAsync(r => r.Id == id && r.ModuleId == moduleId && r.TenantId == tenantId);

        if (report == null) return NotFound();

        if (dto.Name != null) report.Name = dto.Name;
        if (dto.Type != null) report.Type = dto.Type;
        if (dto.Configuration != null) report.Configuration = dto.Configuration;
        if (dto.IsActive.HasValue) report.IsActive = dto.IsActive.Value;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [HasModulePermission("Update")]
    public async Task<IActionResult> DeleteReport(int moduleId, int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var report = await _context.ModuleReports
            .FirstOrDefaultAsync(r => r.Id == id && r.ModuleId == moduleId && r.TenantId == tenantId);

        if (report == null) return NotFound();

        _context.ModuleReports.Remove(report);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id}/data")]
    [HasModulePermission("View")]
    public async Task<ActionResult<ReportDataDto>> GetReportData(int moduleId, int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        try
        {
            var data = await _reportService.ExecuteReportAsync(moduleId, id, tenantId);
            return Ok(data);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
