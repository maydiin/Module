using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Services;
using Module.Services.Caching;

namespace Module.Features.Records.Queries;

public record ListRecordsByNameQuery(string ModuleName) : IQuery<IEnumerable<ModuleRecordDto>>;

public class ListRecordsByNameHandler : IRequestHandler<ListRecordsByNameQuery, IEnumerable<ModuleRecordDto>>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IModuleCacheService _moduleCacheService;
    private readonly ITenantService _tenantService;

    public ListRecordsByNameHandler(AppDbContext context, IModuleService moduleService, IModuleCacheService moduleCacheService, ITenantService tenantService)
    {
        _context = context;
        _moduleService = moduleService;
        _moduleCacheService = moduleCacheService;
        _tenantService = tenantService;
    }

    public async Task<IEnumerable<ModuleRecordDto>> Handle(ListRecordsByNameQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var module = await _moduleCacheService.GetModuleByNameAsync(request.ModuleName, tenantId);
            
        if (module == null)
        {
            throw new KeyNotFoundException($"Module '{request.ModuleName}' not found");
        }

        var records = await _context.ModuleRecords
            .Where(r => r.ModuleId == module.Id)
            .OrderByDescending(r => r.CreatedAt)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var recordIds = records.Select(r => r.Id).ToList();
        
        var targetCounts = await _context.RecordRelations
            .Where(r => r.TargetModule == request.ModuleName && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count, cancellationToken);

        var sourceCounts = await _context.RecordRelations
            .Where(r => r.SourceModule == request.ModuleName && recordIds.Contains(r.SourceRecordId))
            .GroupBy(r => r.SourceRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count, cancellationToken);

        return records.Select(r => new ModuleRecordDto
        {
            Id = r.Id,
            ModuleId = r.ModuleId,
            Data = _moduleService.DeserializeData(r.Data),
            LinkedCount = targetCounts.GetValueOrDefault(r.Id, 0) + sourceCounts.GetValueOrDefault(r.Id, 0),
            CreatedAt = r.CreatedAt
        }).ToList();
    }
}
