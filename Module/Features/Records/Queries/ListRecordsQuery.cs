using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;
using Module.FieldTypes;
using System.Globalization;
using System.Text.Json;

namespace Module.Features.Records.Queries;

public record ListRecordsQuery(
    int ModuleId,
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    string? SortBy = null,
    string? SortDir = null,
    string? Filters = null) : IQuery<PagedResult<ModuleRecordDto>>;

public class ListRecordsHandler : IRequestHandler<ListRecordsQuery, PagedResult<ModuleRecordDto>>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly FieldTypeFactory _fieldTypeFactory;

    public ListRecordsHandler(AppDbContext context, IModuleService moduleService, FieldTypeFactory fieldTypeFactory)
    {
        _context = context;
        _moduleService = moduleService;
        _fieldTypeFactory = fieldTypeFactory;
    }

    public async Task<PagedResult<ModuleRecordDto>> Handle(ListRecordsQuery request, CancellationToken cancellationToken)
    {
        var module = await _context.Modules
            .Include(m => m.Fields)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == request.ModuleId, cancellationToken);
            
        if (module == null)
        {
            throw new KeyNotFoundException("Module not found");
        }

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, request.PageSize);

        var query = _context.ModuleRecords
            .Where(r => r.ModuleId == request.ModuleId)
            .AsNoTracking();

        // 1. Global Search
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            query = query.Where(r => EF.Functions.Like(r.Data, $"%{request.Search}%"));
        }

        var fieldMap = module.Fields.ToDictionary(f => f.Name, f => f);
        var filterList = ParseFilters(request.Filters);

        // 2. Advanced Filtering
        foreach (var filter in filterList)
        {
            if (string.IsNullOrWhiteSpace(filter.Field)) continue;
            
            var fieldName = filter.Field;
            var op = (filter.Operator ?? "contains").Trim().ToLowerInvariant();
            var filterValue = filter.Value;
            
            if (fieldMap.TryGetValue(fieldName, out var field) && field.IsStored)
            {
                var jsonPath = $"$.{fieldName}";
                query = ApplyFilterToQuery(query, field, jsonPath, op, filterValue, filter.ValueTo);
            }
            else if (fieldName.StartsWith("__"))
            {
                query = ApplySpecialFilterToQuery(query, fieldName, op, filterValue, filter.ValueTo);
            }
        }

        // 3. Counting
        var total = await query.CountAsync(cancellationToken);

        // 4. Sorting
        var descending = (request.SortDir ?? "desc").Equals("desc", StringComparison.OrdinalIgnoreCase);
        var normalizedSortBy = string.IsNullOrWhiteSpace(request.SortBy) ? "__createdAt" : request.SortBy;

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
            query = descending ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt);
        }

        // 5. Pagination
        var records = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // 6. Linked Counts & Virtual Formulas
        var recordIds = records.Select(r => r.Id).ToList();
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == module.Name && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count, cancellationToken);

        var pageItems = records.Select(r =>
        {
            var data = _moduleService.DeserializeData(r.Data);
            
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

        return new PagedResult<ModuleRecordDto>
        {
            Items = pageItems,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    private static IQueryable<ModuleRecord> ApplyFilterToQuery(IQueryable<ModuleRecord> query, ModuleField field, string jsonPath, string op, string? value, string? valueTo)
    {
        if (op == "isempty") return query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) == null || AppDbContext.JsonValue(r.Data, jsonPath) == "");
        if (op == "isnotempty") return query.Where(r => AppDbContext.JsonValue(r.Data, jsonPath) != null && AppDbContext.JsonValue(r.Data, jsonPath) != "");

        if (string.IsNullOrWhiteSpace(value)) return query;

        if (field.Type is "number" or "currency" or "percentage")
        {
            if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var decimalValue))
            {
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

    private static IQueryable<ModuleRecord> ApplySpecialFilterToQuery(IQueryable<ModuleRecord> query, string fieldName, string op, string? value, string? valueTo)
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

    private static IQueryable<ModuleRecord> ApplySortingToQuery(IQueryable<ModuleRecord> query, ModuleField field, string jsonPath, bool descending)
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

    private static IQueryable<ModuleRecord> ApplySpecialSortingToQuery(IQueryable<ModuleRecord> query, string sortBy, bool descending)
    {
        return sortBy switch
        {
            "__id" or "id" => descending ? query.OrderByDescending(r => r.Id) : query.OrderBy(r => r.Id),
            "__createdAt" or "createdAt" => descending ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt),
            _ => descending ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt)
        };
    }

    private static List<RecordFilterDto> ParseFilters(string? filters)
    {
        if (string.IsNullOrWhiteSpace(filters)) return new List<RecordFilterDto>();
        try
        {
            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            return JsonSerializer.Deserialize<List<RecordFilterDto>>(filters, options) ?? new List<RecordFilterDto>();
        }
        catch { return new List<RecordFilterDto>(); }
    }
}
