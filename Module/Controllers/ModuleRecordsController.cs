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

        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var currentUserId = int.TryParse(userIdStr, out var id) ? id : (int?)null;

        var result = await _mediator.Send(new Features.Records.Commands.CreateRecordCommand(moduleId, dto.Data, currentUserId));
        
        var module = await _context.Modules.Include(m => m.Fields).FirstOrDefaultAsync(m => m.Id == moduleId);
        if (module != null && module.AuditCreate)
        {
            var displayValue = GetRecordDisplayValue(module, result.Data);
            var entityName = string.IsNullOrEmpty(displayValue) ? $"{module.Name} #{result.Id}" : $"{module.Name} - {displayValue}";
            var details = JsonSerializer.Serialize(dto.Data);
            await _auditLogService.LogAsync("Create", "Record", result.Id.ToString(), entityName, details);
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

        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var currentUserId = int.TryParse(userIdStr, out var id) ? id : (int?)null;

        var result = await _mediator.Send(new Features.Records.Commands.BulkCreateRecordsCommand(moduleId, recordsData, currentUserId));
        
        var module = await _context.Modules.FindAsync(moduleId);
        if (module != null && module.AuditCreate)
        {
            var details = JsonSerializer.Serialize(new { Count = result.Count, Sample = recordsData.FirstOrDefault() });
            await _auditLogService.LogAsync("BulkCreate", "Record", $"{result.Count} records", $"{module.Name} (Bulk)", details);
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

        // Visibility Rules Hook
        query = await ApplyVisibilityRulesAsync(query, module);

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
        await _relationService.EnrichWithDisplayValuesAsync(module, recordsData);

        var pageItems = records.Select((r, i) =>
        {
            var data = recordsData[i];
            
            _moduleService.ComputeFormulas(module, data);

            return new ModuleRecordDto
            {
                Id = r.Id,
                ModuleId = r.ModuleId,
                Data = data,
                LinkedCount = counts.GetValueOrDefault(r.Id, 0),
                CreatedAt = r.CreatedAt,
                ApprovalStatus = r.ApprovalStatus
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
        var module = await _context.Modules.Include(m => m.Fields).FirstOrDefaultAsync(m => m.Id == moduleId);
        if (module == null) return NotFound();

        var query = _context.ModuleRecords
            .Where(r => r.Id == recordId && r.ModuleId == moduleId);
            
        // Apply Visibility Rules Hook
        query = await ApplyVisibilityRulesAsync(query, module);

        var record = await query
            .Include(r => r.Module)
            .ThenInclude(m => m.Fields)
            .FirstOrDefaultAsync();

        if (record == null)
        {
            return NotFound();
        }

        var count = await _context.RecordRelations
            .CountAsync(r => r.TargetModule == record.Module.Name && r.TargetRecordId == record.Id);

        var data = _moduleService.DeserializeData(record.Data);
        var recordsData = new List<Dictionary<string, object>> { data };
        await _relationService.EnrichWithDisplayValuesAsync(record.Module, recordsData);
        _moduleService.ComputeFormulas(record.Module, data);

        return Ok(new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = data,
            LinkedCount = count,
            CreatedAt = record.CreatedAt,
            ApprovalStatus = record.ApprovalStatus
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
        
        var module = await _context.Modules.Include(m => m.Fields).FirstOrDefaultAsync(m => m.Id == moduleId);
        if (module != null && module.AuditUpdate)
        {
            var displayValue = GetRecordDisplayValue(module, result.Data);
            var entityName = string.IsNullOrEmpty(displayValue) ? $"{module.Name} #{recordId}" : $"{module.Name} - {displayValue}";
            var details = JsonSerializer.Serialize(dto.Data);
            await _auditLogService.LogAsync("Update", "Record", recordId.ToString(), entityName, details);
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
            var details = JsonSerializer.Serialize(new { Count = result.Count, Sample = updates.FirstOrDefault()?.Data });
            await _auditLogService.LogAsync("BulkUpdate", "Record", $"{result.Count} records", $"{module.Name} (Bulk)", details);
        }

        return Ok(result);
    }

    [HttpPost("{recordId}/approve")]
    [HasModulePermission("Update")]
    public async Task<IActionResult> ApproveRecord(int moduleId, int recordId)
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

        var approvalService = HttpContext.RequestServices.GetRequiredService<IApprovalService>();
        try
        {
            await approvalService.ApproveRecordAsync(moduleId, recordId, userId);
            
            // Execute AfterApproved hook
            var record = await _context.ModuleRecords.FindAsync(recordId);
            if (record != null)
            {
                var data = _moduleService.DeserializeData(record.Data);
                await _scriptService.ExecuteAfterHookAsync("AfterApproved", moduleId, data);
            }

            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{recordId}/reject")]
    [HasModulePermission("Update")]
    public async Task<IActionResult> RejectRecord(int moduleId, int recordId, [FromBody] RejectRequestDto dto)
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

        var approvalService = HttpContext.RequestServices.GetRequiredService<IApprovalService>();
        try
        {
            await approvalService.RejectRecordAsync(moduleId, recordId, userId, dto.Reason);
            
            // Execute AfterRejected hook
            var record = await _context.ModuleRecords.FindAsync(recordId);
            if (record != null)
            {
                var data = _moduleService.DeserializeData(record.Data);
                await _scriptService.ExecuteAfterHookAsync("AfterRejected", moduleId, data);
            }

            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
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
            var details = JsonSerializer.Serialize(new { RecordId = recordId });
            await _auditLogService.LogAsync("Delete", "Record", recordId.ToString(), $"{module.Name} #{recordId}", details);
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
            var details = JsonSerializer.Serialize(new { Count = recordIds.Count, Ids = recordIds });
            await _auditLogService.LogAsync("BulkDelete", "Record", $"{recordIds.Count} records", $"{module.Name} (Bulk)", details);
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

        // Visibility Rules Hook
        query = await ApplyVisibilityRulesAsync(query, module);

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
        await _relationService.EnrichWithDisplayValuesAsync(module, recordsData);

        var recordDtos = records.Select((r, i) =>
        {
            var data = recordsData[i];
            _moduleService.ComputeFormulas(module, data);

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

    private async Task<IQueryable<Module.Entities.ModuleRecord>> ApplyVisibilityRulesAsync(IQueryable<Module.Entities.ModuleRecord> query, Module.Entities.Module module)
    {
        var isSuperAdminClaim = User.FindFirst("IsSuperAdmin");
        if (isSuperAdminClaim != null && bool.TryParse(isSuperAdminClaim.Value, out var isSuperAdmin) && isSuperAdmin)
        {
            return query; // Super admins see everything
        }

        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdStr, out var userId)) return query.Where(r => false); // Safety fallback

        var userRoleIds = await _context.UserRoles
            .Where(ur => ur.UserId == userId)
            .Select(ur => ur.RoleId)
            .ToListAsync();

        var rules = await _context.ModuleVisibilityRules
            .Where(r => r.ModuleId == module.Id && r.IsActive)
            .Where(r => r.RoleId == null || userRoleIds.Contains(r.RoleId.Value))
            .ToListAsync();

        if (!rules.Any()) return query;

        var showRules = rules.Where(r => r.Action == "Show").ToList();
        var hideRules = rules.Where(r => r.Action == "Hide").ToList();

        foreach (var hr in hideRules)
        {
            query = query.Where(BuildRuleExpression(hr, negate: true, userId, module));
        }

        if (showRules.Any())
        {
            System.Linq.Expressions.Expression<Func<Module.Entities.ModuleRecord, bool>>? combinedShow = null;
            foreach (var sr in showRules)
            {
                var expr = BuildRuleExpression(sr, negate: false, userId, module);
                if (combinedShow == null)
                    combinedShow = expr;
                else
                    combinedShow = CombineWithOr(combinedShow, expr);
            }
            if (combinedShow != null)
                query = query.Where(combinedShow);
        }

        return query;
    }

    private System.Linq.Expressions.Expression<Func<Module.Entities.ModuleRecord, bool>> CombineWithOr(
        System.Linq.Expressions.Expression<Func<Module.Entities.ModuleRecord, bool>> first, 
        System.Linq.Expressions.Expression<Func<Module.Entities.ModuleRecord, bool>> second)
    {
        var parameter = System.Linq.Expressions.Expression.Parameter(typeof(Module.Entities.ModuleRecord), "r");

        var leftVisitor = new ReplaceExpressionVisitor(first.Parameters[0], parameter);
        var left = leftVisitor.Visit(first.Body);

        var rightVisitor = new ReplaceExpressionVisitor(second.Parameters[0], parameter);
        var right = rightVisitor.Visit(second.Body);

        return System.Linq.Expressions.Expression.Lambda<Func<Module.Entities.ModuleRecord, bool>>(
            System.Linq.Expressions.Expression.OrElse(left, right), parameter);
    }

    private class ReplaceExpressionVisitor : System.Linq.Expressions.ExpressionVisitor
    {
        private readonly System.Linq.Expressions.Expression _oldValue;
        private readonly System.Linq.Expressions.Expression _newValue;

        public ReplaceExpressionVisitor(System.Linq.Expressions.Expression oldValue, System.Linq.Expressions.Expression newValue)
        {
            _oldValue = oldValue;
            _newValue = newValue;
        }

        public override System.Linq.Expressions.Expression Visit(System.Linq.Expressions.Expression node)
        {
            if (node == _oldValue)
                return _newValue;
            return base.Visit(node);
        }
    }

    private System.Linq.Expressions.Expression<Func<Module.Entities.ModuleRecord, bool>> BuildRuleExpression(Module.Entities.ModuleVisibilityRule rule, bool negate, int currentUserId, Module.Entities.Module module)
    {
        var fieldName = rule.Field;
        var op = rule.Operator.ToLowerInvariant();
        var val = rule.Value?.Replace("{{CurrentUser.Id}}", currentUserId.ToString()) ?? "";

        if (fieldName == "__createdByUserId")
        {
            if (int.TryParse(val, out var targetUserId))
            {
                if (negate)
                {
                    return op switch { "eq" => r => r.CreatedByUserId != targetUserId, "neq" => r => r.CreatedByUserId == targetUserId, _ => r => true };
                }
                else
                {
                    return op switch { "eq" => r => r.CreatedByUserId == targetUserId, "neq" => r => r.CreatedByUserId != targetUserId, _ => r => false };
                }
            }
            return r => negate;
        }

        var field = module.Fields?.FirstOrDefault(f => f.Name == fieldName);
        var jsonPath = $"$.{fieldName}";

        if (field != null && (field.Type == "number" || field.Type == "currency" || field.Type == "percentage"))
        {
            if (decimal.TryParse(val, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var decimalVal))
            {
                if (negate)
                {
                    return op switch
                    {
                        "eq" or "equals" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) != decimalVal,
                        "neq" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) == decimalVal,
                        "gt" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) <= decimalVal,
                        "lt" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) >= decimalVal,
                        _ => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) != decimalVal
                    };
                }
                else
                {
                    return op switch
                    {
                        "eq" or "equals" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) == decimalVal,
                        "neq" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) != decimalVal,
                        "gt" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) > decimalVal,
                        "lt" => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) < decimalVal,
                        _ => r => Convert.ToDecimal(AppDbContext.JsonValue(r.Data, jsonPath)) == decimalVal
                    };
                }
            }
        }
        else if (field != null && (field.Type == "date" || field.Type == "datetime"))
        {
            if (DateTime.TryParse(val, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeLocal, out var dateVal))
            {
                if (negate)
                {
                    return op switch
                    {
                        "eq" or "equals" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) != dateVal,
                        "neq" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) == dateVal,
                        "gt" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) <= dateVal,
                        "lt" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) >= dateVal,
                        _ => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) != dateVal
                    };
                }
                else
                {
                    return op switch
                    {
                        "eq" or "equals" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) == dateVal,
                        "neq" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) != dateVal,
                        "gt" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) > dateVal,
                        "lt" => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) < dateVal,
                        _ => r => Convert.ToDateTime(AppDbContext.JsonValue(r.Data, jsonPath)) == dateVal
                    };
                }
            }
        }

        if (negate)
        {
             return op switch
             {
                 "eq" or "equals" => r => AppDbContext.JsonValue(r.Data, jsonPath) != val,
                 "neq" => r => AppDbContext.JsonValue(r.Data, jsonPath) == val,
                 "contains" => r => !EF.Functions.Like(AppDbContext.JsonValue(r.Data, jsonPath), $"%{val}%"),
                 _ => r => AppDbContext.JsonValue(r.Data, jsonPath) != val
             };
        }
        else
        {
             return op switch
             {
                 "eq" or "equals" => r => AppDbContext.JsonValue(r.Data, jsonPath) == val,
                 "neq" => r => AppDbContext.JsonValue(r.Data, jsonPath) != val,
                 "contains" => r => EF.Functions.Like(AppDbContext.JsonValue(r.Data, jsonPath), $"%{val}%"),
                 _ => r => AppDbContext.JsonValue(r.Data, jsonPath) == val
             };
        }
    }


    private string? GetRecordDisplayValue(Module.Entities.Module module, Dictionary<string, object> data)
    {
        if (module.Fields == null || !module.Fields.Any()) return null;

        var displayFields = module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
        if (displayFields.Any())
        {
            var vals = new List<string>();
            foreach (var df in displayFields)
            {
                if (data.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                    vals.Add(dfVal.ToString()!);
            }
            if (vals.Any()) return string.Join(" - ", vals);
        }
        else
        {
            var fallbackField = module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
            if (fallbackField != null && data.TryGetValue(fallbackField.Name, out var val) && val != null)
                return val.ToString();
        }
        
        return null;
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
