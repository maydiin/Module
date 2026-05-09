using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;

namespace Module.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;

    public DashboardService(AppDbContext context, IModuleService moduleService)
    {
        _context = context;
        _moduleService = moduleService;
    }

    public async Task<WidgetDataDto> GetWidgetDataAsync(int widgetId, int tenantId, int userId)
    {
        var widget = await _context.DashboardWidgets
            .FirstOrDefaultAsync(w => w.Id == widgetId && w.TenantId == tenantId && w.UserId == userId);

        if (widget == null)
            throw new KeyNotFoundException("Widget not found");

        var config = JsonSerializer.Deserialize<JsonElement>(widget.Configuration);
        var result = new WidgetDataDto { WidgetType = widget.WidgetType };

        if (!config.TryGetProperty("moduleId", out var modProp) || !modProp.TryGetInt32(out var moduleId))
            return result;

        var moduleName = await _context.Modules
            .Where(m => m.Id == moduleId && m.TenantId == tenantId)
            .Select(m => m.Name)
            .FirstOrDefaultAsync();
        result.ModuleName = moduleName;

        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId);

        ApplyTimePeriod(ref query, config);

        switch (widget.WidgetType)
        {
            case "stat_card":
                await ComputeStatCard(query, config, result);
                break;
            case "bar_chart":
            case "pie_chart":
                await ComputeGroupedChart(query, config, result);
                break;
            case "line_chart":
                await ComputeLineChart(query, config, result);
                break;
            case "recent_records":
                await ComputeRecentRecords(query, config, result);
                break;
        }

        return result;
    }

    private void ApplyTimePeriod(ref IQueryable<Entities.ModuleRecord> query, JsonElement config)
    {
        if (!config.TryGetProperty("timePeriod", out var tp)) return;
        var period = tp.GetString();
        if (string.IsNullOrEmpty(period) || period == "all") return;

        var days = period switch
        {
            "7d" => 7,
            "30d" => 30,
            "90d" => 90,
            "365d" => 365,
            _ => 0
        };

        if (days > 0)
        {
            var cutoff = DateTime.UtcNow.AddDays(-days);
            query = query.Where(r => r.CreatedAt >= cutoff);
        }
    }

    private async Task ComputeStatCard(IQueryable<Entities.ModuleRecord> query, JsonElement config, WidgetDataDto result)
    {
        var aggType = config.TryGetProperty("aggregateType", out var at) ? at.GetString() ?? "count" : "count";
        var aggField = config.TryGetProperty("aggregateField", out var af) ? af.GetString() : null;

        if (aggType == "count" || string.IsNullOrEmpty(aggField))
        {
            result.StatValue = await query.CountAsync();
            result.StatLabel = "Toplam Kayıt";
            return;
        }

        var records = await query.ToListAsync();
        var values = records
            .Select(r => _moduleService.DeserializeData(r.Data))
            .Select(d => d.TryGetValue(aggField, out var v) ? v : null)
            .Where(v => v != null && decimal.TryParse(v!.ToString(), out _))
            .Select(v => decimal.Parse(v!.ToString()!))
            .ToList();

        result.StatValue = aggType switch
        {
            "sum" => values.Count > 0 ? values.Sum() : 0,
            "avg" => values.Count > 0 ? Math.Round(values.Average(), 2) : 0,
            "min" => values.Count > 0 ? values.Min() : 0,
            "max" => values.Count > 0 ? values.Max() : 0,
            _ => records.Count
        };

        result.StatLabel = aggField;
    }

    private async Task ComputeGroupedChart(IQueryable<Entities.ModuleRecord> query, JsonElement config, WidgetDataDto result)
    {
        var groupByField = config.TryGetProperty("groupByField", out var gf) ? gf.GetString() : null;
        if (string.IsNullOrEmpty(groupByField))
        {
            result.ChartData = new List<ChartDataPointDto>();
            return;
        }

        var aggType = config.TryGetProperty("aggregateType", out var at) ? at.GetString() ?? "count" : "count";
        var aggField = config.TryGetProperty("aggregateField", out var af) ? af.GetString() : null;

        var records = await query.ToListAsync();
        var dataList = records.Select(r => _moduleService.DeserializeData(r.Data)).ToList();
        var grouped = dataList.GroupBy(d => d.TryGetValue(groupByField, out var v) ? v?.ToString() ?? "Diğer" : "Diğer");

        result.ChartData = grouped.Select(g =>
        {
            var point = new ChartDataPointDto { Label = g.Key };

            if (aggType == "count" || string.IsNullOrEmpty(aggField))
            {
                point.Value = g.Count();
            }
            else
            {
                var vals = g.Select(d => d.TryGetValue(aggField, out var v) ? v : null)
                            .Where(v => v != null && decimal.TryParse(v!.ToString(), out _))
                            .Select(v => decimal.Parse(v!.ToString()!))
                            .ToList();

                point.Value = aggType switch
                {
                    "sum" => vals.Count > 0 ? vals.Sum() : 0,
                    "avg" => vals.Count > 0 ? Math.Round(vals.Average(), 2) : 0,
                    "min" => vals.Count > 0 ? vals.Min() : 0,
                    "max" => vals.Count > 0 ? vals.Max() : 0,
                    _ => g.Count()
                };
            }

            return point;
        }).OrderByDescending(p => p.Value).Take(20).ToList();
    }

    private async Task ComputeLineChart(IQueryable<Entities.ModuleRecord> query, JsonElement config, WidgetDataDto result)
    {
        var groupBy = config.TryGetProperty("lineGroupBy", out var lg) ? lg.GetString() ?? "day" : "day";

        var records = await query.OrderBy(r => r.CreatedAt).ToListAsync();

        result.ChartData = groupBy switch
        {
            "month" => records
                .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month })
                .Select(g => new ChartDataPointDto
                {
                    Label = $"{g.Key.Year}-{g.Key.Month:D2}",
                    Value = g.Count()
                }).ToList(),
            "week" => records
                .GroupBy(r => System.Globalization.ISOWeek.GetWeekOfYear(r.CreatedAt))
                .Select(g => new ChartDataPointDto
                {
                    Label = $"Hafta {g.Key}",
                    Value = g.Count()
                }).ToList(),
            _ => records
                .GroupBy(r => r.CreatedAt.Date)
                .Select(g => new ChartDataPointDto
                {
                    Label = g.Key.ToString("MM-dd"),
                    Value = g.Count()
                }).ToList()
        };
    }

    private async Task ComputeRecentRecords(IQueryable<Entities.ModuleRecord> query, JsonElement config, WidgetDataDto result)
    {
        var limit = config.TryGetProperty("limit", out var lp) && lp.TryGetInt32(out var l) ? l : 5;

        var records = await query.OrderByDescending(r => r.CreatedAt).Take(limit).ToListAsync();
        var rows = records.Select(r => _moduleService.DeserializeData(r.Data)).ToList();

        result.Rows = rows;

        if (config.TryGetProperty("columns", out var cols) && cols.ValueKind == JsonValueKind.Array)
        {
            result.Columns = cols.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList();
        }
        else if (rows.Count > 0)
        {
            result.Columns = rows[0].Keys.Take(5).ToList();
        }
        else
        {
            result.Columns = new List<string>();
        }
    }
}
