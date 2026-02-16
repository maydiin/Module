using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Entities;

namespace Module.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;

    public ReportService(AppDbContext context, IModuleService moduleService)
    {
        _context = context;
        _moduleService = moduleService;
    }

    public async Task<ReportDataDto> ExecuteReportAsync(int moduleId, int reportId, int tenantId)
    {
        var report = await _context.ModuleReports
            .FirstOrDefaultAsync(r => r.Id == reportId && r.ModuleId == moduleId && r.TenantId == tenantId);

        if (report == null)
            throw new KeyNotFoundException("Report not found");

        var config = JsonSerializer.Deserialize<JsonElement>(report.Configuration);
        
        var result = new ReportDataDto
        {
            ReportName = report.Name,
            ReportType = report.Type
        };

        if (report.Type == "List")
        {
            await ExecuteListReport(moduleId, tenantId, config, result);
        }
        else if (report.Type == "Chart")
        {
            await ExecuteChartReport(moduleId, tenantId, config, result);
        }

        return result;
    }

    private async Task ExecuteListReport(int moduleId, int tenantId, JsonElement config, ReportDataDto result)
    {
        // For simple list, just return the records
        var records = await _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(100)
            .ToListAsync();

        result.Rows = records.Select(r => _moduleService.DeserializeData(r.Data)).ToList();
        
        if (config.TryGetProperty("columns", out var cols))
        {
            result.Columns = cols.EnumerateArray().Select(x => x.GetString() ?? "").ToList();
        }
        else if (result.Rows.Count > 0)
        {
            result.Columns = result.Rows[0].Keys.ToList();
        }
    }

    private async Task ExecuteChartReport(int moduleId, int tenantId, JsonElement config, ReportDataDto result)
    {
        if (!config.TryGetProperty("groupBy", out var groupByProp))
        {
            result.ChartData = new List<ChartDataPointDto>();
            return;
        }

        var groupByField = groupByProp.GetString();
        if (string.IsNullOrEmpty(groupByField))
        {
            result.ChartData = new List<ChartDataPointDto>();
            return;
        }

        var jsonPath = $"$.{groupByField}";
        
        // Grouping by dynamic JSON value
        var data = await _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId)
            .GroupBy(r => AppDbContext.JsonValue(r.Data, jsonPath))
            .Select(g => new ChartDataPointDto
            {
                Label = g.Key ?? "Unknown",
                Value = g.Count()
            })
            .ToListAsync();

        result.ChartData = data;
    }
}
