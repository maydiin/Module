using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Services;
using Module.FieldTypes;

namespace Module.Controllers;

[ApiController]
[Route("api/modules/{moduleId}/records")]
public class ModuleRecordsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly MediatR.IMediator _mediator;
    private readonly FieldTypeFactory _fieldTypeFactory;

    public ModuleRecordsController(AppDbContext context, IModuleService moduleService, IRelationService relationService, MediatR.IMediator mediator, FieldTypeFactory fieldTypeFactory)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _mediator = mediator;
        _fieldTypeFactory = fieldTypeFactory;
    }

    [HttpPost]
    public async Task<ActionResult<ModuleRecordDto>> CreateRecord(int moduleId, [FromBody] CreateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        try 
        {
            var result = await _mediator.Send(new Features.Records.Commands.CreateRecordCommand(moduleId, dto.Data));
            return CreatedAtAction(nameof(GetRecord), new { moduleId, recordId = result.Id }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            // In a real app, logic inside the handler would throw specific validation exceptions
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<ModuleRecordDto>>> ListRecords(
        int moduleId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] string? filters = null)
    {
        var module = await _context.Modules
            .Include(m => m.Fields)
            .FirstOrDefaultAsync(m => m.Id == moduleId);
            
        if (module == null)
        {
            return NotFound(new { error = "Module not found" });
        }

        if (page < 1)
        {
            page = 1;
        }

        if (pageSize < 1)
        {
            pageSize = 20;
        }

        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == moduleId)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(r => EF.Functions.Like(r.Data, $"%{search}%"));
        }

        var records = await query.ToListAsync();

        var recordIds = records.Select(r => r.Id).ToList();
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == module.Name && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count);

        var fieldMap = module.Fields.ToDictionary(f => f.Name, f => f);
        var recordInfos = records.Select(r =>
        {
            var data = _moduleService.DeserializeData(r.Data);
            
            // Compute non-stored formula fields at runtime
            // Ordered by OrderNo to ensure dependencies are calculated first
            foreach (var field in module.Fields.OrderBy(f => f.OrderNo))
            {
                if (field.Type == "formula")
                {
                    try
                    {
                        // If it's not stored, we MUST calculate it
                        // If it IS stored, it might depend on a non-stored field, so we might need to recalculate or just ensure dependencies exist?
                        // Simple approach: Always calculate non-stored fields. 
                        // Stored fields are already in 'data'. 
                        // BUT if a stored field depends on a non-stored field, the non-stored field needs to be in 'data' first.
                        
                        if (!field.IsStored) 
                        {
                            var fieldType = _fieldTypeFactory.Get(field.Type);
                            var computedValue = fieldType.Compute(field, data);
                            if (computedValue != null)
                            {
                                data[field.Name] = computedValue;
                            }
                        }
                        
                        // If a stored field depends on a non-stored field, we might need to recalculate it locally for display purposes if the DB value is stale/wrong?
                        // For now, let's assume stored fields are correct in DB, but if they depend on non-stored fields, those non-stored fields are needed for display regardless.
                    }
                    catch (ArgumentException)
                    {
                        // Field type not supported, ignore
                    }
                }
            }
            
            return new RecordInfo
            {
                Record = r,
                Data = data,
                LinkedCount = counts.GetValueOrDefault(r.Id, 0)
            };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim();
            recordInfos = recordInfos
                .Where(info => MatchesSearch(info, module, searchTerm))
                .ToList();
        }

        var filterList = ParseFilters(filters);
        if (filterList.Count > 0)
        {
            recordInfos = recordInfos
                .Where(info => MatchesFilters(info, module, fieldMap, filterList))
                .ToList();
        }

        var normalizedSortBy = string.IsNullOrWhiteSpace(sortBy) ? "createdAt" : sortBy;
        var normalizedSortDir = string.IsNullOrWhiteSpace(sortDir) ? "desc" : sortDir;
        recordInfos = ApplySorting(recordInfos, module, fieldMap, normalizedSortBy, normalizedSortDir);

        var total = recordInfos.Count;
        var totalPages = total == 0 ? 1 : (int)Math.Ceiling(total / (double)pageSize);
        if (page > totalPages)
        {
            page = totalPages;
        }

        var pageItems = recordInfos
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(info => new ModuleRecordDto
            {
                Id = info.Record.Id,
                ModuleId = info.Record.ModuleId,
                Data = info.Data,
                LinkedCount = info.LinkedCount,
                CreatedAt = info.Record.CreatedAt
            })
            .ToList();

        return Ok(new PagedResult<ModuleRecordDto>
        {
            Items = pageItems,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    [HttpGet("{recordId}")]
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

        return Ok(new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = _moduleService.DeserializeData(record.Data),
            LinkedCount = count,
            CreatedAt = record.CreatedAt
        });
    }

    [HttpPut("{recordId}")]
    public async Task<ActionResult<ModuleRecordDto>> UpdateRecord(int moduleId, int recordId, [FromBody] UpdateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        try
        {
            var result = await _mediator.Send(new Features.Records.Commands.UpdateRecordCommand(moduleId, recordId, dto.Data));
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{recordId}")]
    public async Task<IActionResult> DeleteRecord(int moduleId, int recordId)
    {
        try
        {
            await _mediator.Send(new Features.Records.Commands.DeleteRecordCommand(moduleId, recordId));
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
             return BadRequest(new { error = ex.Message });
        }
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

        var recordIds = records.Select(r => r.Id).ToList();
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == moduleName && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count);

        var recordDtos = records.Select(r => new ModuleRecordDto
        {
            Id = r.Id,
            ModuleId = r.ModuleId,
            Data = _moduleService.DeserializeData(r.Data),
            LinkedCount = counts.GetValueOrDefault(r.Id, 0),
            CreatedAt = r.CreatedAt
        }).ToList();

        return Ok(recordDtos);
    }

    private sealed class RecordInfo
    {
        public Module.Entities.ModuleRecord Record { get; init; } = null!;
        public Dictionary<string, object> Data { get; init; } = new();
        public int LinkedCount { get; init; }
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

    private static bool MatchesSearch(RecordInfo info, Module.Entities.Module module, string searchTerm)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return true;
        }

        var lowered = searchTerm.ToLowerInvariant();
        if (info.Record.Id.ToString(CultureInfo.InvariantCulture).Contains(lowered))
        {
            return true;
        }

        if (info.LinkedCount.ToString(CultureInfo.InvariantCulture).Contains(lowered))
        {
            return true;
        }

        if (info.Record.CreatedAt.ToString("s", CultureInfo.InvariantCulture).ToLowerInvariant().Contains(lowered))
        {
            return true;
        }

        foreach (var pair in info.Data)
        {
            if (ValueToSearchText(pair.Value).Contains(lowered))
            {
                return true;
            }
        }

        return false;
    }

    private static bool MatchesFilters(
        RecordInfo info,
        Module.Entities.Module module,
        Dictionary<string, Module.Entities.ModuleField> fieldMap,
        List<RecordFilterDto> filters)
    {
        foreach (var filter in filters)
        {
            if (!MatchesFilter(info, module, fieldMap, filter))
            {
                return false;
            }
        }

        return true;
    }

    private static bool MatchesFilter(
        RecordInfo info,
        Module.Entities.Module module,
        Dictionary<string, Module.Entities.ModuleField> fieldMap,
        RecordFilterDto filter)
    {
        var field = filter.Field ?? string.Empty;
        var op = (filter.Operator ?? "contains").Trim().ToLowerInvariant();
        var fieldType = ResolveFieldType(field, fieldMap);
        var value = ResolveFieldValue(info, field);
        var normalizedValue = NormalizeValue(value);

        if (op == "isempty")
        {
            return IsEmpty(normalizedValue);
        }

        if (op == "isnotempty")
        {
            return !IsEmpty(normalizedValue);
        }

        if (normalizedValue is IEnumerable<object?> listValue && normalizedValue is not string)
        {
            var items = listValue.ToList();
            return MatchesAgainstList(items, op, filter, fieldType);
        }

        return MatchesScalar(normalizedValue, op, filter, fieldType);
    }

    private static string ResolveFieldType(string field, Dictionary<string, Module.Entities.ModuleField> fieldMap)
    {
        if (field == "__id" || field == "__linkedCount")
        {
            return "number";
        }

        if (field == "__createdAt")
        {
            return "datetime";
        }

        return fieldMap.TryGetValue(field, out var moduleField) ? moduleField.Type : "text";
    }

    private static object? ResolveFieldValue(RecordInfo info, string field)
    {
        return field switch
        {
            "__id" => info.Record.Id,
            "__linkedCount" => info.LinkedCount,
            "__createdAt" => info.Record.CreatedAt,
            _ => info.Data.TryGetValue(field, out var value) ? value : null
        };
    }

    private static bool MatchesAgainstList(
        List<object?> items,
        string op,
        RecordFilterDto filter,
        string fieldType)
    {
        if (op == "contains")
        {
            return items.Any(item => MatchesScalar(item, "contains", filter, fieldType));
        }

        if (op is "eq" or "equals")
        {
            return items.Any(item => MatchesScalar(item, "eq", filter, fieldType));
        }

        if (op == "in")
        {
            var targets = ParseList(filter.Value);
            return items.Any(item => targets.Contains(ValueToSearchText(item)));
        }

        return items.Any(item => MatchesScalar(item, op, filter, fieldType));
    }

    private static bool MatchesScalar(object? value, string op, RecordFilterDto filter, string fieldType)
    {
        if (op is "eq" or "equals")
        {
            return ValuesEqual(value, filter.Value, fieldType);
        }

        if (op == "ne")
        {
            return !ValuesEqual(value, filter.Value, fieldType);
        }

        if (op == "contains")
        {
            return ValueToSearchText(value).Contains(NormalizeSearch(filter.Value));
        }

        if (op == "starts")
        {
            return ValueToSearchText(value).StartsWith(NormalizeSearch(filter.Value));
        }

        if (op == "ends")
        {
            return ValueToSearchText(value).EndsWith(NormalizeSearch(filter.Value));
        }

        if (op == "in")
        {
            var targets = ParseList(filter.Value);
            return targets.Contains(ValueToSearchText(value));
        }

        if (op is "gt" or "gte" or "lt" or "lte" or "before" or "after")
        {
            return CompareValues(value, filter.Value, fieldType, op);
        }

        if (op == "between")
        {
            return BetweenValues(value, filter.Value, filter.ValueTo, fieldType);
        }

        return true;
    }

    private static bool ValuesEqual(object? value, string? filterValue, string fieldType)
    {
        if (value == null && string.IsNullOrWhiteSpace(filterValue))
        {
            return true;
        }

        if (TryGetComparableValue(value, fieldType, out var comparableValue) &&
            TryParseFilterValue(filterValue, fieldType, out var comparableFilter))
        {
            return comparableValue.Equals(comparableFilter);
        }

        return string.Equals(ValueToSearchText(value), NormalizeSearch(filterValue), StringComparison.OrdinalIgnoreCase);
    }

    private static bool CompareValues(object? value, string? filterValue, string fieldType, string op)
    {
        if (!TryGetComparableValue(value, fieldType, out var comparableValue) ||
            !TryParseFilterValue(filterValue, fieldType, out var comparableFilter))
        {
            return false;
        }

        var comparison = Comparer<object>.Default.Compare(comparableValue, comparableFilter);
        return op switch
        {
            "gt" or "after" => comparison > 0,
            "gte" => comparison >= 0,
            "lt" or "before" => comparison < 0,
            "lte" => comparison <= 0,
            _ => false
        };
    }

    private static bool BetweenValues(object? value, string? fromValue, string? toValue, string fieldType)
    {
        if (!TryGetComparableValue(value, fieldType, out var comparableValue))
        {
            return false;
        }

        var hasFrom = TryParseFilterValue(fromValue, fieldType, out var comparableFrom);
        var hasTo = TryParseFilterValue(toValue, fieldType, out var comparableTo);

        if (!hasFrom && !hasTo)
        {
            return true;
        }

        if (hasFrom && Comparer<object>.Default.Compare(comparableValue, comparableFrom) < 0)
        {
            return false;
        }

        if (hasTo && Comparer<object>.Default.Compare(comparableValue, comparableTo) > 0)
        {
            return false;
        }

        return true;
    }

    private static bool TryGetComparableValue(object? value, string fieldType, out object comparable)
    {
        comparable = 0m;
        if (fieldType is "number" or "currency" or "percentage")
        {
            if (TryToDecimal(value, out var decimalValue))
            {
                comparable = decimalValue;
                return true;
            }
            return false;
        }

        if (fieldType is "date" or "datetime")
        {
            if (TryToDate(value, out var dateValue))
            {
                comparable = dateValue;
                return true;
            }
            return false;
        }

        if (fieldType == "checkbox")
        {
            if (TryToBool(value, out var boolValue))
            {
                comparable = boolValue;
                return true;
            }
            return false;
        }

        comparable = ValueToSearchText(value);
        return true;
    }

    private static bool TryParseFilterValue(string? value, string fieldType, out object comparable)
    {
        comparable = string.Empty;
        if (fieldType is "number" or "currency" or "percentage")
        {
            if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var decimalValue))
            {
                comparable = decimalValue;
                return true;
            }
            return false;
        }

        if (fieldType is "date" or "datetime")
        {
            if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dateValue))
            {
                comparable = dateValue;
                return true;
            }
            return false;
        }

        if (fieldType == "checkbox")
        {
            if (bool.TryParse(value, out var boolValue))
            {
                comparable = boolValue;
                return true;
            }
            return false;
        }

        comparable = NormalizeSearch(value);
        return true;
    }

    private static bool TryToDecimal(object? value, out decimal result)
    {
        result = 0m;
        if (value == null)
        {
            return false;
        }

        if (value is decimal decimalValue)
        {
            result = decimalValue;
            return true;
        }

        if (value is double doubleValue)
        {
            result = (decimal)doubleValue;
            return true;
        }

        if (value is float floatValue)
        {
            result = (decimal)floatValue;
            return true;
        }

        if (value is int intValue)
        {
            result = intValue;
            return true;
        }

        if (value is long longValue)
        {
            result = longValue;
            return true;
        }

        return decimal.TryParse(value.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out result);
    }

    private static bool TryToDate(object? value, out DateTime result)
    {
        result = default;
        if (value == null)
        {
            return false;
        }

        if (value is DateTime dateTime)
        {
            result = dateTime;
            return true;
        }

        return DateTime.TryParse(value.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out result);
    }

    private static bool TryToBool(object? value, out bool result)
    {
        result = false;
        if (value == null)
        {
            return false;
        }

        if (value is bool boolValue)
        {
            result = boolValue;
            return true;
        }

        return bool.TryParse(value.ToString(), out result);
    }

    private static bool IsEmpty(object? value)
    {
        if (value == null)
        {
            return true;
        }

        if (value is string stringValue)
        {
            return string.IsNullOrWhiteSpace(stringValue);
        }

        if (value is IEnumerable<object?> listValue)
        {
            return !listValue.Any();
        }

        return false;
    }

    private static string NormalizeSearch(string? value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant();
    }

    private static List<string> ParseList(string? value)
    {
        return (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Trim().ToLowerInvariant())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToList();
    }

    private static object? NormalizeValue(object? value)
    {
        if (value is JsonElement jsonElement)
        {
            return NormalizeJsonElement(jsonElement);
        }

        return value;
    }

    private static object? NormalizeJsonElement(JsonElement jsonElement)
    {
        return jsonElement.ValueKind switch
        {
            JsonValueKind.String => jsonElement.GetString(),
            JsonValueKind.Number => jsonElement.TryGetDecimal(out var number) ? number : jsonElement.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Array => jsonElement.EnumerateArray().Select(NormalizeJsonElement).ToList(),
            JsonValueKind.Null => null,
            JsonValueKind.Undefined => null,
            _ => jsonElement.GetRawText()
        };
    }

    private static string ValueToSearchText(object? value)
    {
        if (value == null)
        {
            return string.Empty;
        }

        if (value is IEnumerable<object?> listValue && value is not string)
        {
            return string.Join(" ", listValue.Select(ValueToSearchText));
        }

        return value.ToString()?.ToLowerInvariant() ?? string.Empty;
    }

    private static List<RecordInfo> ApplySorting(
        List<RecordInfo> recordInfos,
        Module.Entities.Module module,
        Dictionary<string, Module.Entities.ModuleField> fieldMap,
        string sortBy,
        string sortDir)
    {
        var descending = sortDir.Equals("desc", StringComparison.OrdinalIgnoreCase);
        Func<RecordInfo, object?> keySelector;

        if (sortBy == "__id" || sortBy.Equals("id", StringComparison.OrdinalIgnoreCase))
        {
            keySelector = info => info.Record.Id;
        }
        else if (sortBy == "__linkedCount")
        {
            keySelector = info => info.LinkedCount;
        }
        else if (sortBy == "__createdAt" || sortBy.Equals("createdAt", StringComparison.OrdinalIgnoreCase))
        {
            keySelector = info => info.Record.CreatedAt;
        }
        else
        {
            keySelector = info => info.Data.TryGetValue(sortBy, out var value) ? NormalizeSortValue(value) : null;
        }

        return descending
            ? recordInfos.OrderByDescending(keySelector, Comparer<object?>.Default).ToList()
            : recordInfos.OrderBy(keySelector, Comparer<object?>.Default).ToList();
    }

    private static object? NormalizeSortValue(object? value)
    {
        var normalized = NormalizeValue(value);
        if (normalized is IEnumerable<object?> listValue && normalized is not string)
        {
            return string.Join(" ", listValue.Select(ValueToSearchText));
        }

        return normalized;
    }
}
