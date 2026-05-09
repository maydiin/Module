using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/dashboard/widgets")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IDashboardService _dashboardService;

    public DashboardController(AppDbContext context, ITenantService tenantService, IDashboardService dashboardService)
    {
        _context = context;
        _tenantService = tenantService;
        _dashboardService = dashboardService;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && int.TryParse(claim.Value, out var id)) return id;
        return 0;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DashboardWidgetDto>>> GetWidgets()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var userId = GetUserId();

        var widgets = await _context.DashboardWidgets
            .Where(w => w.TenantId == tenantId && w.UserId == userId)
            .OrderBy(w => w.SortOrder)
            .ThenBy(w => w.Id)
            .Select(w => new DashboardWidgetDto
            {
                Id = w.Id,
                Title = w.Title,
                WidgetType = w.WidgetType,
                Configuration = w.Configuration,
                ColSpan = w.ColSpan,
                SortOrder = w.SortOrder,
                CreatedAt = w.CreatedAt
            })
            .ToListAsync();

        return Ok(widgets);
    }

    [HttpPost]
    public async Task<ActionResult<DashboardWidgetDto>> CreateWidget(CreateDashboardWidgetDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var userId = GetUserId();

        var widget = new DashboardWidget
        {
            TenantId = tenantId,
            UserId = userId,
            Title = dto.Title,
            WidgetType = dto.WidgetType,
            Configuration = dto.Configuration,
            ColSpan = dto.ColSpan,
            SortOrder = dto.SortOrder
        };

        _context.DashboardWidgets.Add(widget);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetWidgets), new DashboardWidgetDto
        {
            Id = widget.Id,
            Title = widget.Title,
            WidgetType = widget.WidgetType,
            Configuration = widget.Configuration,
            ColSpan = widget.ColSpan,
            SortOrder = widget.SortOrder,
            CreatedAt = widget.CreatedAt
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateWidget(int id, UpdateDashboardWidgetDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var userId = GetUserId();

        var widget = await _context.DashboardWidgets
            .FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tenantId && w.UserId == userId);

        if (widget == null) return NotFound();

        if (dto.Title != null) widget.Title = dto.Title;
        if (dto.WidgetType != null) widget.WidgetType = dto.WidgetType;
        if (dto.Configuration != null) widget.Configuration = dto.Configuration;
        if (dto.ColSpan.HasValue) widget.ColSpan = dto.ColSpan.Value;
        if (dto.SortOrder.HasValue) widget.SortOrder = dto.SortOrder.Value;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWidget(int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var userId = GetUserId();

        var widget = await _context.DashboardWidgets
            .FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tenantId && w.UserId == userId);

        if (widget == null) return NotFound();

        _context.DashboardWidgets.Remove(widget);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/data")]
    public async Task<ActionResult<WidgetDataDto>> GetWidgetData(int id)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var userId = GetUserId();

        try
        {
            var data = await _dashboardService.GetWidgetDataAsync(id, tenantId, userId);
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

    // Toplu sıralama güncelleme (sürükle-bırak sonrası)
    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderWidgets([FromBody] List<int> orderedIds)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var userId = GetUserId();

        var widgets = await _context.DashboardWidgets
            .Where(w => w.TenantId == tenantId && w.UserId == userId)
            .ToListAsync();

        for (int i = 0; i < orderedIds.Count; i++)
        {
            var w = widgets.FirstOrDefault(x => x.Id == orderedIds[i]);
            if (w != null) w.SortOrder = i;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }
}
