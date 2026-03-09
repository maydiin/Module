using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Services;
using Module.FieldTypes;
using Module.Authorization;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/records")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class ModuleRecordsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly MediatR.IMediator _mediator;
    private readonly FieldTypeFactory _fieldTypeFactory;
    private readonly ITenantService _tenantService;
    private readonly IAuditLogService _auditLogService;
    private readonly Module.Services.Scripting.IScriptService _scriptService;

    public ModuleRecordsController(AppDbContext context, IModuleService moduleService, IRelationService relationService, MediatR.IMediator mediator, FieldTypeFactory fieldTypeFactory, ITenantService tenantService, IAuditLogService auditLogService, Module.Services.Scripting.IScriptService scriptService)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _mediator = mediator;
        _fieldTypeFactory = fieldTypeFactory;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
        _scriptService = scriptService;
    }

    [HttpPost]
    [HasModulePermission("Create")]
    public async Task<ActionResult<ModuleRecordDto>> CreateRecord(int moduleId, [FromBody] CreateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        // Script Hook: BeforeCreate
        await _scriptService.ExecuteBeforeHookAsync("BeforeCreate", moduleId, dto.Data);

        var result = await _mediator.Send(new Features.Records.Commands.CreateRecordCommand(moduleId, dto.Data));
        
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null && module.AuditCreate)
        {
            await _auditLogService.LogAsync("Create", "Record", result.Id.ToString(), $"Module:{moduleId}");
        }
        
        // Script Hook: AfterCreate
        await _scriptService.ExecuteAfterHookAsync("AfterCreate", moduleId, result.Data);
        
        return CreatedAtAction(nameof(GetRecord), new { moduleId, recordId = result.Id }, result);
    }

    [HttpPost("bulk")]
    [HasModulePermission("Create")]
    public async Task<ActionResult<List<ModuleRecordDto>>> BulkCreateRecords(int moduleId, [FromBody] List<Dictionary<string, object>> recordsData)
    {
        if (recordsData == null || !recordsData.Any())
        {
            return BadRequest(new { error = "Records data is required" });
        }

        var result = await _mediator.Send(new Features.Records.Commands.BulkCreateRecordsCommand(moduleId, recordsData));
        
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null && module.AuditCreate)
        {
            await _auditLogService.LogAsync("BulkCreate", "Record", $"{result.Count} records", $"Module:{moduleId}");
        }
        
        return Ok(result);
    }

    [HttpGet]
    [HasModulePermission("View")]
    public async Task<ActionResult<PagedResult<ModuleRecordDto>>> ListRecords(
        int moduleId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] string? filters = null)
    {
        // Script Override: CustomList
        // Pass query options to the script
        var queryOptions = new Module.Services.Scripting.RecordQueryOptions 
        { 
            Page = page, 
            PageSize = pageSize, 
            Search = search, 
            Filters = filters,
            SortBy = sortBy,
            SortDir = sortDir
        };

        // We need tenantId here for the script check
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var overrideResult = await _scriptService.ExecuteListOverrideAsync(moduleId, tenantId, queryOptions);
        if (overrideResult != null)
        {
            return Ok(overrideResult);
        }

        var module = await _context.Modules
            .Include(m => m.Fields)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == moduleId);
            
        if (module == null)
        {
            return NotFound(new { error = "Module not found" });
        }

        page = Math.Max(1, page);
        pageSize = Math.Max(1, pageSize);

        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId)
            .AsNoTracking();
            
        // Always apply tenant filter (TenantService handles super admin header override)
        query = query.Where(r => r.TenantId == tenantId);

        // 1. Global Search (at DB level)
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(r => EF.Functions.Like(r.Data, $"%{search}%"));
        }

        var fieldMap = module.Fields.ToDictionary(f => f.Name, f => f);
        var filterList = ParseFilters(filters);

        // 2. Advanced Filtering (at DB level using JSON_VALUE)
        foreach (var filter in filterList)
        {
            if (string.IsNullOrWhiteSpace(filter.Field)) continue;
            
            var fieldName = filter.Field;
            var op = (filter.Operator ?? "contains").Trim().ToLowerInvariant();
            var filterValue = filter.Value;
            
            if (fieldMap.TryGetValue(fieldName, out var field) && field.IsStored)
            {
                var jsonPath = $"$.{fieldName}";
                
                // Note: SQL Server JSON_VALUE is used for scalar values.
                // For performance, we build the query dynamically.
                query = ApplyFilterToQuery(query, field, jsonPath, op, filterValue, filter.ValueTo);
            }
            else if (fieldName.StartsWith("__")) // Special fields
            {
                query = ApplySpecialFilterToQuery(query, fieldName, op, filterValue, filter.ValueTo);
            }
        }

        // 3. Counting (at DB level)
        var total = await query.CountAsync();

        // 4. Sorting (at DB level)
        var descending = (sortDir ?? "desc").Equals("desc", StringComparison.OrdinalIgnoreCase);
        var normalizedSortBy = string.IsNullOrWhiteSpace(sortBy) ? "__createdAt" : sortBy;

        if (fieldMap.TryGetValue(normalizedSortBy, out var sortField) && sortField.IsStored)
        {
            var jsonPath = $"$.{normalizedSortBy}";
            query = ApplySortingToQuery(query, sortField, jsonPath, descending);
        }
        else if (normalizedSortBy.StartsWith("__") || normalizedSortBy.Equals("id", StringComparison.OrdinalIgnoreCase) || normalizedSortBy.Equals("createdAt", StringComparison.OrdinalIgnoreCase))
        {
            query = ApplySpecialSortingToQuery(query, normalizedSortBy, descending);
        }
        else
        {
            // Default sort
            query = descending ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt);
        }

        // 5. Pagination (at DB level)
        var records = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // 6. Linked Counts & Virtual Formulas (only for the paginated results)
        var recordIds = records.Select(r => r.Id).ToList();
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == module.Name && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count);

        var recordsData = records.Select(r => _moduleService.DeserializeData(r.Data)).ToList();
        await EnrichWithDisplayValues(module, records, recordsData);

        var pageItems = records.Select((r, i) =>
        {
            var data = recordsData[i];
            
            // Compute non-stored formula fields at runtime (only for these records)
            foreach (var field in module.Fields.Where(f => !f.IsStored).OrderBy(f => f.OrderNo))
            {
                try
                {
                    var fieldType = _fieldTypeFactory.Get(field.Type);
                    var computedValue = fieldType.Compute(field, data);
                    if (computedValue != null)
                    {
                        data[field.Name] = computedValue;
                    }
                }
                catch (Exception) { /* ignore */ }
            }
            
            var displayFields = module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
            if (displayFields.Any())
            {
                var vals = new List<string>();
                foreach (var df in displayFields)
                {
                    if (data.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                        vals.Add(dfVal.ToString()!);
                }
                if (vals.Any()) data["__displayValue"] = string.Join(" - ", vals);
            }
            else
            {
                var fallbackField = module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
                if (fallbackField != null && data.TryGetValue(fallbackField.Name, out var val) && val != null)
                    data["__displayValue"] = val.ToString() ?? r.Id.ToString();
                else
                    data["__displayValue"] = r.Id.ToString();
            }

            return new ModuleRecordDto
            {
                Id = r.Id,
                ModuleId = r.ModuleId,
                Data = data,
                LinkedCount = counts.GetValueOrDefault(r.Id, 0),
                CreatedAt = r.CreatedAt
            };
        }).ToList();

        var totalPages = total == 0 ? 1 : (int)Math.Ceiling(total / (double)pageSize);

        return Ok(new PagedResult<ModuleRecordDto>
        {
            Items = pageItems,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    private static IQueryable<Module.Entities.ModuleRecord> ApplyFilterToQuery(
        IQueryable<Module.Entities.ModuleRecord> query,
        Module.Entities.ModuleField field,
        string jsonPath,
        string op,
        string? value,
        string? valueTo)
    {
        // Simple string-based value extraction
        // For numbers/dates we might need casting but SQL Server comparison works okay-ish with JSON_VALUE strings 
        // OR we can use specialized functions.
        
        if (op == "isempty") return query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == null || AppDbContext.JsonValue(r.Data, jsonPath) == "");
        if (op == "isnotempty") return query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) != null && AppDbContext.JsonValue(r.Data, jsonPath) != "");

        if (string.IsNullOrWhiteSpace(value)) return query;

        // Numeric types
        if (field.Type is "number" or "currency" or "percentage")
        {
            if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var decimalValue))
            {
                if (op == "between" && decimal.TryParse(valueTo, NumberStyles.Any, CultureInfo.InvariantCulture, out var decimalValueTo))
                {
                    return query.Where(r =>
                        Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) >= decimalValue &&
                        Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) <= decimalValueTo);
                }

                return op switch
                {
                    "eq" or "equals" => query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == value),
                    "gt" => query.Where(r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) > decimalValue),
                    "gte" => query.Where(r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) >= decimalValue),
                    "lt" => query.Where(r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) < decimalValue),
                    "lte" => query.Where(r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) <= decimalValue),
                    _ => query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == value)
                };
            }
        }

        // Date types
        if (field.Type is "date" or "datetime")
        {
            if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dateValue))
            {
                if (op == "between" && DateTime.TryParse(valueTo, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dateValueTo))
                {
                    return query.Where(r =>
                        Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) >= dateValue &&
                        Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) <= dateValueTo);
                }

                return op switch
                {
                    "before" or "lt" => query.Where(r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) < dateValue),
                    "after" or "gt" => query.Where(r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) > dateValue),
                    "eq" or "equals" => query.Where(r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) == dateValue),
                    _ => query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == value)
                };
            }
        }

        // Text types (default)
        return op switch
        {
            "contains" => query.Where(r => EF.Functions.Like(AppDbContext.JsonValue(r.Data, jsonPath), $"%{value}%")),
            "starts" => query.Where(r => EF.Functions.Like(AppDbContext.JsonValue(r.Data, jsonPath), $"{value}%")),
            "ends" => query.Where(r => EF.Functions.Like(AppDbContext.JsonValue(r.Data, jsonPath), $"%{value}")),
            "eq" or "equals" => query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == value),
            "ne" => query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) != value),
            _ => query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == value)
        };
    }

    private static IQueryable<Module.Entities.ModuleRecord> ApplySpecialFilterToQuery(
        IQueryable<Module.Entities.ModuleRecord> query,
        string fieldName,
        string op,
        string? value,
        string? valueTo)
    {
        if (fieldName == "__id")
        {
            if (int.TryParse(value, out var id))
            {
                return op switch
                {
                    "eq" or "equals" => query.Where(r => r.Id == id),
                    "gt" => query.Where(r => r.Id > id),
                    "lt" => query.Where(r => r.Id < id),
                    _ => query.Where(r => r.Id == id)
                };
            }
        }

        if (fieldName == "__createdAt")
        {
            if (DateTime.TryParse(value, out var date))
            {
                if (op == "between" && DateTime.TryParse(valueTo, out var dateTo))
                {
                    return query.Where(r => r.CreatedAt >= date && r.CreatedAt <= dateTo);
                }

                return op switch
                {
                    "before" or "lt" => query.Where(r => r.CreatedAt < date),
                    "after" or "gt" => query.Where(r => r.CreatedAt > date),
                    _ => query.Where(r => r.CreatedAt == date)
                };
            }
        }

        return query;
    }

    private static IQueryable<Module.Entities.ModuleRecord> ApplySortingToQuery(
        IQueryable<Module.Entities.ModuleRecord> query,
        Module.Entities.ModuleField field,
        string jsonPath,
        bool descending)
    {
        if (field.Type is "number" or "currency" or "percentage")
        {
            return descending 
                ? query.OrderByDescending(r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)))
                : query.OrderBy(r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)));
        }

        if (field.Type is "date" or "datetime")
        {
            return descending 
                ? query.OrderByDescending(r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)))
                : query.OrderBy(r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)));
        }

        return descending 
            ? query.OrderByDescending(r => AppDbContext.JsonValue(r.Data, jsonPath))
            : query.OrderBy(r => AppDbContext.JsonValue(r.Data, jsonPath));
    }

    private static IQueryable<Module.Entities.ModuleRecord> ApplySpecialSortingToQuery(
        IQueryable<Module.Entities.ModuleRecord> query,
        string sortBy,
        bool descending)
    {
        return sortBy switch
        {
            "__id" or "id" => descending ? query.OrderByDescending(r => r.Id) : query.OrderBy(r => r.Id),
            "__createdAt" or "createdAt" => descending ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt),
            _ => descending ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt)
        };
    }

    [HttpGet("{recordId}")]
    [HasModulePermission("View")]
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

        var data = _moduleService.DeserializeData(record.Data);
        await EnrichWithDisplayValues(record.Module, new List<Module.Entities.ModuleRecord> { record }, new List<Dictionary<string, object>> { data });

        var displayFields = record.Module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
        if (displayFields.Any())
        {
            var vals = new List<string>();
            foreach (var df in displayFields)
            {
                if (data.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                    vals.Add(dfVal.ToString()!);
            }
            if (vals.Any()) data["__displayValue"] = string.Join(" - ", vals);
        }
        else
        {
            var fallbackField = record.Module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
            if (fallbackField != null && data.TryGetValue(fallbackField.Name, out var val) && val != null)
                data["__displayValue"] = val.ToString() ?? record.Id.ToString();
            else
                data["__displayValue"] = record.Id.ToString();
        }

        return Ok(new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = data,
            LinkedCount = count,
            CreatedAt = record.CreatedAt
        });
    }

    [HttpPut("{recordId}")]
    [HasModulePermission("Update")]
    public async Task<ActionResult<ModuleRecordDto>> UpdateRecord(int moduleId, int recordId, [FromBody] UpdateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        // Script Hook: BeforeUpdate
        await _scriptService.ExecuteBeforeHookAsync("BeforeUpdate", moduleId, dto.Data);

        var result = await _mediator.Send(new Features.Records.Commands.UpdateRecordCommand(moduleId, recordId, dto.Data));
        
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null && module.AuditUpdate)
        {
            await _auditLogService.LogAsync("Update", "Record", recordId.ToString(), $"Module:{moduleId}");
        }
        
        // Script Hook: AfterUpdate
        await _scriptService.ExecuteAfterHookAsync("AfterUpdate", moduleId, result.Data);

        return Ok(result);
    }

    [HttpPut("bulk")]
    [HasModulePermission("Update")]
    public async Task<ActionResult<List<ModuleRecordDto>>> BulkUpdateRecords(int moduleId, [FromBody] List<Features.Records.Commands.BulkUpdateItem> updates)
    {
        if (updates == null || !updates.Any())
        {
            return BadRequest(new { error = "Updates are required" });
        }

        var result = await _mediator.Send(new Features.Records.Commands.BulkUpdateRecordsCommand(moduleId, updates));
        
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null && module.AuditUpdate)
        {
            await _auditLogService.LogAsync("BulkUpdate", "Record", $"{result.Count} records", $"Module:{moduleId}");
        }

        return Ok(result);
    }

    [HttpDelete("{recordId}")]
    [HasModulePermission("Delete")]
    public async Task<IActionResult> DeleteRecord(int moduleId, int recordId)
    {
        // Script Hook: BeforeDelete
        var deleteContext = new Dictionary<string, object> { { "Id", recordId } };
        await _scriptService.ExecuteBeforeHookAsync("BeforeDelete", moduleId, deleteContext);

        await _mediator.Send(new Features.Records.Commands.DeleteRecordCommand(moduleId, recordId));
        
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null && module.AuditDelete)
        {
            await _auditLogService.LogAsync("Delete", "Record", recordId.ToString(), $"Module:{moduleId}");
        }
        
        // Script Hook: AfterDelete
        await _scriptService.ExecuteAfterHookAsync("AfterDelete", moduleId, deleteContext);

        return NoContent();
    }

    [HttpDelete("bulk")]
    [HasModulePermission("Delete")]
    public async Task<IActionResult> BulkDeleteRecords(int moduleId, [FromBody] List<int> recordIds)
    {
        if (recordIds == null || !recordIds.Any())
        {
            return BadRequest(new { error = "Record IDs are required" });
        }

        await _mediator.Send(new Features.Records.Commands.BulkDeleteRecordsCommand(moduleId, recordIds));
        
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null && module.AuditDelete)
        {
            await _auditLogService.LogAsync("BulkDelete", "Record", $"{recordIds.Count} records", $"Module:{moduleId}");
        }

        return NoContent();
    }

    [HttpGet("/api/records/by-name/{moduleName}")]
    [HasModulePermission("View")]
    public async Task<ActionResult<PagedResult<ModuleRecordDto>>> ListRecordsByName(
        string moduleName, 
        [FromQuery] string? search = null, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20)
    {
        var module = await _context.Modules
            .Include(m => m.Fields)
            .FirstOrDefaultAsync(m => m.Name == moduleName);
            
        if (module == null)
        {
            return NotFound(new { error = $"Module '{moduleName}' not found" });
        }

        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == module.Id)
            .AsNoTracking();

        // Tenant filter
        var tenantId = _tenantService.GetCurrentTenantId();
        query = query.Where(r => r.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            // Search in the Data JSON
            query = query.Where(r => EF.Functions.Like(r.Data, $"%{search}%"));
        }

        var total = await query.CountAsync();
        
        var records = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var recordIds = records.Select(r => r.Id).ToList();
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == moduleName && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count);

        var recordsData = records.Select(r => _moduleService.DeserializeData(r.Data)).ToList();
        await EnrichWithDisplayValues(module, records, recordsData);

        var recordDtos = records.Select((r, i) =>
        {
            var data = recordsData[i];
            var displayFields = module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
            if (displayFields.Any())
            {
                var vals = new List<string>();
                foreach (var df in displayFields)
                {
                    if (data.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                        vals.Add(dfVal.ToString()!);
                }
                if (vals.Any()) data["__displayValue"] = string.Join(" - ", vals);
            }
            else
            {
                var fallbackField = module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
                if (fallbackField != null && data.TryGetValue(fallbackField.Name, out var val) && val != null)
                    data["__displayValue"] = val.ToString() ?? r.Id.ToString();
                else
                    data["__displayValue"] = r.Id.ToString();
            }

            return new ModuleRecordDto
            {
                Id = r.Id,
                ModuleId = r.ModuleId,
                Data = data,
                LinkedCount = counts.GetValueOrDefault(r.Id, 0),
                CreatedAt = r.CreatedAt
            };
        }).ToList();

        var totalPages = total == 0 ? 1 : (int)Math.Ceiling(total / (double)pageSize);

        return Ok(new PagedResult<ModuleRecordDto>
        {
            Items = recordDtos,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    private async Task EnrichWithDisplayValues(Module.Entities.Module module, List<Module.Entities.ModuleRecord> records, List<Dictionary<string, object>> recordsData)
    {
        var relationFields = module.Fields.Where(f => f.Type == "relation" || f.Type == "multiselect-relation").ToList();
        if (!relationFields.Any() || !records.Any()) return;
        
        var targetRecordIds = new Dictionary<string, HashSet<int>>(); 
        
        foreach (var data in recordsData)
        {
            foreach (var field in relationFields)
            {
                if (string.IsNullOrWhiteSpace(field.Options)) continue;
                var targetModule = field.Options.Trim('\"');
                
                if (data.TryGetValue(field.Name, out var val) && val != null)
                {
                    if (!targetRecordIds.ContainsKey(targetModule)) targetRecordIds[targetModule] = new HashSet<int>();
                    
                    if (val is JsonElement el)
                    {
                        if (el.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in el.EnumerateArray())
                                if (item.TryGetInt32(out var tid)) targetRecordIds[targetModule].Add(tid);
                        }
                        else if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var tid))
                        {
                            targetRecordIds[targetModule].Add(tid);
                        }
                    }
                    else if (int.TryParse(val.ToString(), out var tid))
                    {
                        targetRecordIds[targetModule].Add(tid);
                    }
                }
            }
        }
        
        var displayValuesMap = new Dictionary<string, Dictionary<int, string>>();
        foreach (var kvp in targetRecordIds)
        {
            var targetModule = kvp.Key;
            var ids = kvp.Value.ToList();
            if (!ids.Any()) continue;
            
            var targetRecords = await _context.ModuleRecords
                .Include(tr => tr.Module)
                .ThenInclude(trM => trM.Fields)
                .Where(tr => tr.Module.Name == targetModule && ids.Contains(tr.Id))
                .ToListAsync();
                
            displayValuesMap[targetModule] = new Dictionary<int, string>();
            foreach (var tr in targetRecords)
            {
                var trData = _moduleService.DeserializeData(tr.Data);
                var displayFields = tr.Module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
                string displayStr = tr.Id.ToString();
                
                if (displayFields.Any())
                {
                    var vals = new List<string>();
                    foreach (var df in displayFields)
                    {
                         if (trData.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                             vals.Add(dfVal.ToString()!);
                    }
                    if (vals.Any()) displayStr = string.Join(" - ", vals);
                }
                else
                {
                     var fallbackField = tr.Module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
                     if (fallbackField != null && trData.TryGetValue(fallbackField.Name, out var val) && val != null)
                         displayStr = val.ToString() ?? tr.Id.ToString();
                }
                
                displayValuesMap[targetModule][tr.Id] = displayStr;
            }
        }

        foreach (var data in recordsData)
        {
            foreach (var field in relationFields)
            {
                if (string.IsNullOrWhiteSpace(field.Options)) continue;
                var targetModule = field.Options.Trim('\"');
                if (!displayValuesMap.ContainsKey(targetModule)) continue;
                
                if (data.TryGetValue(field.Name, out var val) && val != null)
                {
                    var displayStrings = new List<string>();
                    
                    if (val is JsonElement el)
                    {
                        if (el.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in el.EnumerateArray())
                                if (item.TryGetInt32(out var tid) && displayValuesMap[targetModule].ContainsKey(tid)) 
                                    displayStrings.Add(displayValuesMap[targetModule][tid]);
                        }
                        else if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var tid) && displayValuesMap[targetModule].ContainsKey(tid))
                        {
                            displayStrings.Add(displayValuesMap[targetModule][tid]);
                        }
                    }
                    else if (int.TryParse(val.ToString(), out var tid) && displayValuesMap[targetModule].ContainsKey(tid))
                    {
                        displayStrings.Add(displayValuesMap[targetModule][tid]);
                    }
                    
                    if (displayStrings.Any())
                    {
                        data[$"__display_{field.Name}"] = string.Join(", ", displayStrings);
                    }
                }
            }
        }
    }

    private static List<RecordFilterDto> ParseFilters(string? filters)
    {
        if (string.IsNullOrWhiteSpace(filters))
        {
            return new List<RecordFilterDto>();
        }

        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
            var parsed = JsonSerializer.Deserialize<List<RecordFilterDto>>(filters, options);
            return parsed ?? new List<RecordFilterDto>();
        }
        catch (JsonException)
        {
            return new List<RecordFilterDto>();
        }
    }
}
