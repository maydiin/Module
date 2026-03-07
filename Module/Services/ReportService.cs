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
        else if (report.Type == "Pivot")
        {
            await ExecutePivotReport(moduleId, tenantId, config, result);
        }

        return result;
    }

    private async Task ExecuteListReport(int moduleId, int tenantId, JsonElement config, ReportDataDto result)
    {
        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId);

        // Apply filters
        ApplyFilters(ref query, config);

        // Apply sorting
        ApplySorting(ref query, config);

        // Apply limit
        int limit = 100;
        if (config.TryGetProperty("limit", out var limitProp) && limitProp.TryGetInt32(out var l))
        {
            limit = l;
        }
        
        var records = await query.Take(limit).ToListAsync();

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

    private void ApplyFilters(ref IQueryable<ModuleRecord> query, JsonElement config)
    {
        if (config.TryGetProperty("filters", out var filters) && filters.ValueKind == JsonValueKind.Array)
        {
            foreach (var filter in filters.EnumerateArray())
            {
                if (filter.TryGetProperty("field", out var field) && 
                    filter.TryGetProperty("operator", out var op) && 
                    filter.TryGetProperty("value", out var val))
                {
                    var fieldName = field.GetString();
                    var opStr = op.GetString();
                    var value = val.ValueKind == JsonValueKind.String ? val.GetString() : val.GetRawText();
                    
                    if (string.IsNullOrEmpty(fieldName) || string.IsNullOrEmpty(opStr) || value == null) continue;

                    var jsonPath = $"$.{fieldName}";
                    
                    if (opStr == "==" || opStr == "equals") {
                        query = query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == value);
                    }
                    else if (opStr == "!=" || opStr == "notEquals") {
                        query = query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) != value);
                    }
                    else if (opStr == "contains") {
                        // EF Core might not support Contains on DB functions directly in all providers, 
                        // but let's try standard equality/comparison first.
                    }
                }
            }
        }
    }

    private void ApplySorting(ref IQueryable<ModuleRecord> query, JsonElement config)
    {
        if (config.TryGetProperty("sortBy", out var sortByProp))
        {
            var sortBy = sortByProp.GetString();
            if (!string.IsNullOrEmpty(sortBy))
            {
                var sortOrder = "asc";
                if (config.TryGetProperty("sortOrder", out var orderProp))
                {
                    sortOrder = orderProp.GetString()?.ToLower() ?? "asc";
                }

                var jsonPath = $"$.{sortBy}";
                if (sortOrder == "desc")
                {
                    query = query.OrderByDescending(r => AppDbContext.JsonValue(r.Data, jsonPath));
                }
                else
                {
                    query = query.OrderBy(r => AppDbContext.JsonValue(r.Data, jsonPath));
                }
                return;
            }
        }
        
        query = query.OrderByDescending(r => r.CreatedAt);
    }

    private async Task ExecuteChartReport(int moduleId, int tenantId, JsonElement config, ReportDataDto result)
    {
        var chartType = "bar";
        if (config.TryGetProperty("chartType", out var ctProp))
        {
            chartType = ctProp.GetString()?.ToLower() ?? "bar";
        }

        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId);

        // Filters can also apply to charts!
        ApplyFilters(ref query, config);

        if (chartType == "bubble" || chartType == "heatmap" || chartType == "scatter")
        {
            await ExecuteMultiDimensionalChart(moduleId, tenantId, config, query, result);
            return;
        }

        if (chartType == "gauge" && !config.TryGetProperty("groupBy", out _))
        {
            await ExecuteTotalAggregate(moduleId, tenantId, config, query, result);
            return;
        }

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
        
        var aggregateField = config.TryGetProperty("aggregateField", out var af) ? af.GetString() : null;
        var aggregateType = config.TryGetProperty("aggregateType", out var at) ? at.GetString()?.ToLower() : "count";

        if (string.IsNullOrEmpty(aggregateField) && aggregateType != "count")
        {
            result.ChartData = new List<ChartDataPointDto>();
            return;
        }

        var records = await query.ToListAsync();
        var dataList = records.Select(r => _moduleService.DeserializeData(r.Data)).ToList();

        var groupedData = dataList.GroupBy(d => d.TryGetValue(groupByField, out var val) ? val?.ToString() : "Unknown");

        result.ChartData = groupedData.Select(g => {
            var point = new ChartDataPointDto { Label = g.Key ?? "Unknown" };
            
            if (aggregateType == "count")
            {
                point.Value = g.Count();
            }
            else if (!string.IsNullOrEmpty(aggregateField))
            {
                var valuesInGroup = g.Select(d => d.TryGetValue(aggregateField, out var v) ? v : null)
                                     .Where(v => v != null)
                                     .Select(v => decimal.TryParse(v!.ToString(), out var d) ? d : 0)
                                     .ToList();

                switch (aggregateType)
                {
                    case "sum":
                        point.Value = valuesInGroup.Sum();
                        break;
                    case "avg":
                        point.Value = valuesInGroup.Count > 0 ? valuesInGroup.Average() : 0;
                        break;
                    case "min":
                        point.Value = valuesInGroup.Count > 0 ? valuesInGroup.Min() : 0;
                        break;
                    case "max":
                        point.Value = valuesInGroup.Count > 0 ? valuesInGroup.Max() : 0;
                        break;
                    default:
                        point.Value = g.Count();
                        break;
                }
            }
            else
            {
                point.Value = g.Count();
            }
            
            return point;
        }).ToList();
    }

    private async Task ExecuteTotalAggregate(int moduleId, int tenantId, JsonElement config, IQueryable<ModuleRecord> query, ReportDataDto result)
    {
        var aggregateField = config.TryGetProperty("aggregateField", out var af) ? af.GetString() : null;
        var aggregateType = config.TryGetProperty("aggregateType", out var at) ? at.GetString()?.ToLower() : "count";

        decimal totalValue = 0;
        if (aggregateType == "sum" && !string.IsNullOrEmpty(aggregateField))
        {
            var aggPath = $"$.{aggregateField}";
            totalValue = await query.SumAsync(r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, aggPath)));
        }
        else
        {
            totalValue = await query.CountAsync();
        }

        result.ChartData = new List<ChartDataPointDto>
        {
            new ChartDataPointDto { Label = "Total", Value = totalValue }
        };
    }

    private async Task ExecuteMultiDimensionalChart(int moduleId, int tenantId, JsonElement config, IQueryable<ModuleRecord> query, ReportDataDto result)
    {
        int limit = 1000;
        if (config.TryGetProperty("limit", out var limitProp) && limitProp.TryGetInt32(out var l))
        {
            limit = l;
        }

        var records = await query.Take(limit).ToListAsync();
        
        var xAxisField = config.TryGetProperty("xAxisField", out var xf) ? xf.GetString() : null;
        var yAxisField = config.TryGetProperty("yAxisField", out var yf) ? yf.GetString() : null;
        var zAxisField = config.TryGetProperty("zAxisField", out var zf) ? zf.GetString() : null;
        var labelField = config.TryGetProperty("labelField", out var lf) ? lf.GetString() : null;
        var valueField = config.TryGetProperty("valueField", out var vf) ? vf.GetString() : null;

        result.ChartData = records.Select(r => {
            var data = _moduleService.DeserializeData(r.Data);
            var point = new ChartDataPointDto();
            
            if (labelField != null && data.TryGetValue(labelField, out var label)) point.Label = label?.ToString() ?? "";
            
            if (valueField != null && data.TryGetValue(valueField, out var val))
            {
                if (decimal.TryParse(val?.ToString(), out var v)) point.Value = v;
            }
            else
            {
                point.Value = 1;
            }

            if (xAxisField != null && data.TryGetValue(xAxisField, out var x)) point.X = x;
            if (yAxisField != null && data.TryGetValue(yAxisField, out var y)) point.Y = y;
            if (zAxisField != null && data.TryGetValue(zAxisField, out var z))
            {
                if (decimal.TryParse(z?.ToString(), out var zv)) point.Z = zv;
            }
            
            return point;
        }).ToList();
    }

    private async Task ExecutePivotReport(int moduleId, int tenantId, JsonElement config, ReportDataDto result)
    {
        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId);

        ApplyFilters(ref query, config);

        var limit = 2000; // Pivot reports might need more data for aggregation
        if (config.TryGetProperty("limit", out var limitProp) && limitProp.TryGetInt32(out var l))
        {
            limit = l;
        }

        var records = await query.OrderByDescending(r => r.CreatedAt).Take(limit).ToListAsync();
        var dataList = records.Select(r => _moduleService.DeserializeData(r.Data)).ToList();

        if (dataList.Count == 0)
        {
            result.Rows = new List<Dictionary<string, object>>();
            result.Columns = new List<string>();
            return;
        }

        var rowsConfig = config.TryGetProperty("rows", out var rProp) ? rProp.EnumerateArray().Select(x => x.GetString()).Where(x => x != null).ToList() : new List<string?>();
        var colsConfig = config.TryGetProperty("columns", out var cProp) ? cProp.EnumerateArray().Select(x => x.GetString()).Where(x => x != null).ToList() : new List<string?>();
        var values = config.TryGetProperty("values", out var vProp) ? vProp.EnumerateArray().ToList() : new List<JsonElement>();

        // Group by both rows and columns
        var groupByFields = rowsConfig.Concat(colsConfig).Where(x => x != null).Cast<string>().ToList();

        if (groupByFields.Count == 0 && values.Count == 0)
        {
            // Fallback to simple list if no pivot config
            result.Rows = dataList;
            result.Columns = dataList[0].Keys.ToList();
            return;
        }

        var groupedData = dataList.GroupBy(d => {
            var keyObj = new Dictionary<string, object?>();
            foreach (var field in groupByFields)
            {
                keyObj[field] = d.TryGetValue(field, out var val) ? val : null;
            }
            return JsonSerializer.Serialize(keyObj);
        });

        var pivotResult = new List<Dictionary<string, object>>();
        foreach (var group in groupedData)
        {
            var rowData = JsonSerializer.Deserialize<Dictionary<string, object?>>(group.Key) ?? new Dictionary<string, object?>();
            var newRow = new Dictionary<string, object>();
            foreach (var kvp in rowData)
            {
                newRow[kvp.Key] = kvp.Value ?? "";
            }

            foreach (var valConfig in values)
            {
                var field = valConfig.GetProperty("field").GetString();
                var aggType = valConfig.GetProperty("type").GetString()?.ToLower() ?? "sum";
                var label = valConfig.TryGetProperty("label", out var lab) ? lab.GetString() : $"{aggType}({field})";

                if (string.IsNullOrEmpty(field)) continue;

                object finalVal = 0;
                var valuesInGroup = group.Select(g => g.TryGetValue(field, out var v) ? v : null).ToList();

                switch (aggType)
                {
                    case "sum":
                        finalVal = valuesInGroup.Sum(v => v != null && decimal.TryParse(v.ToString(), out var d) ? d : 0);
                        break;
                    case "count":
                        finalVal = valuesInGroup.Count(v => v != null);
                        break;
                    case "avg":
                        var nonNulls = valuesInGroup.Where(v => v != null && decimal.TryParse(v.ToString(), out var d)).Select(v => decimal.Parse(v!.ToString()!)).ToList();
                        finalVal = nonNulls.Count > 0 ? nonNulls.Average() : 0;
                        break;
                    case "min":
                        var nonNullMin = valuesInGroup.Where(v => v != null && decimal.TryParse(v.ToString(), out var d)).Select(v => decimal.Parse(v!.ToString()!)).ToList();
                        finalVal = nonNullMin.Count > 0 ? nonNullMin.Min() : 0;
                        break;
                    case "max":
                        var nonNullMax = valuesInGroup.Where(v => v != null && decimal.TryParse(v.ToString(), out var d)).Select(v => decimal.Parse(v!.ToString()!)).ToList();
                        finalVal = nonNullMax.Count > 0 ? nonNullMax.Max() : 0;
                        break;
                }
                newRow[label!] = finalVal;
            }
            pivotResult.Add(newRow);
        }

        result.Rows = pivotResult;
        if (pivotResult.Count > 0)
        {
            result.Columns = pivotResult[0].Keys.ToList();
        }
    }
}
