using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Services;

namespace Module.Features.Records.Queries;

public record ListRecordsByNameQuery(string ModuleName) : IQuery<IEnumerable<ModuleRecordDto>>;

public class ListRecordsByNameHandler : IRequestHandler<ListRecordsByNameQuery, IEnumerable<ModuleRecordDto>>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;

    public ListRecordsByNameHandler(AppDbContext context, IModuleService moduleService)
    {
        _context = context;
        _moduleService = moduleService;
    }

    public async Task<IEnumerable<ModuleRecordDto>> Handle(ListRecordsByNameQuery request, CancellationToken cancellationToken)
    {
        var module = await _context.Modules
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Name == request.ModuleName, cancellationToken);
            
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
        var counts = await _context.RecordRelations
            .Where(r => r.TargetModule == request.ModuleName && recordIds.Contains(r.TargetRecordId))
            .GroupBy(r => r.TargetRecordId)
            .Select(g => new { RecordId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RecordId, x => x.Count, cancellationToken);

        return records.Select(r => new ModuleRecordDto
        {
            Id = r.Id,
            ModuleId = r.ModuleId,
            Data = _moduleService.DeserializeData(r.Data),
            LinkedCount = counts.GetValueOrDefault(r.Id, 0),
            CreatedAt = r.CreatedAt
        }).ToList();
    }
}
