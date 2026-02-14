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

    public ModuleRecordsController(AppDbContext context, IModuleService moduleService, IRelationService relationService, MediatR.IMediator mediator, FieldTypeFactory fieldTypeFactory, ITenantService tenantService, IAuditLogService auditLogService)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _mediator = mediator;
        _fieldTypeFactory = fieldTypeFactory;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
    }

    [HttpPost]
    [HasModulePermission("Create")]
    public async Task<ActionResult<ModuleRecordDto>> CreateRecord(int moduleId, [FromBody] CreateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        try 
        {
            var result = await _mediator.Send(new Features.Records.Commands.CreateRecordCommand(moduleId, dto.Data));
            
            var module = await _context.Modules.FindAsync(moduleId);
            if (module != null && module.AuditCreate)
            {
                await _auditLogService.LogAsync("Create", "Record", result.Id.ToString(), $"Module:{moduleId}");
            }
            
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
        var tenantId = _tenantService.GetCurrentTenantId();
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

        var pageItems = records.Select(r =>
        {
            var data = _moduleService.DeserializeData(r.Data);
            
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
                // We use dynamic selection because EF Core won't easily cast JsonValue in a generic way inside Where
                // But for now, let's try standard string comparison for simple cases or use raw SQL if it fails
                // Actually, SQL Server JSON_VALUE returns NVARCHAR.
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
    [HasModulePermission("Update")]
    public async Task<ActionResult<ModuleRecordDto>> UpdateRecord(int moduleId, int recordId, [FromBody] UpdateModuleRecordDto dto)
    {
        if (dto.Data == null)
        {
            return BadRequest(new { error = "Data is required" });
        }

        try
        {
            var result = await _mediator.Send(new Features.Records.Commands.UpdateRecordCommand(moduleId, recordId, dto.Data));
            
            var module = await _context.Modules.FindAsync(moduleId);
            if (module != null && module.AuditUpdate)
            {
                await _auditLogService.LogAsync("Update", "Record", recordId.ToString(), $"Module:{moduleId}");
            }
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
    [HasModulePermission("Delete")]
    public async Task<IActionResult> DeleteRecord(int moduleId, int recordId)
    {
        try
        {
            await _mediator.Send(new Features.Records.Commands.DeleteRecordCommand(moduleId, recordId));
            
            var module = await _context.Modules.FindAsync(moduleId);
            if (module != null && module.AuditDelete)
            {
                await _auditLogService.LogAsync("Delete", "Record", recordId.ToString(), $"Module:{moduleId}");
            }
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

        var recordDtos = records.Select(r => new ModuleRecordDto
        {
            Id = r.Id,
            ModuleId = r.ModuleId,
            Data = _moduleService.DeserializeData(r.Data),
            LinkedCount = counts.GetValueOrDefault(r.Id, 0),
            CreatedAt = r.CreatedAt
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
