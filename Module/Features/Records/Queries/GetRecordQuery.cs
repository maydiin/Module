using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Services;

namespace Module.Features.Records.Queries;

public record GetRecordQuery(int ModuleId, int RecordId) : IQuery<ModuleRecordDto>;

public class GetRecordHandler : IRequestHandler<GetRecordQuery, ModuleRecordDto>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;

    public GetRecordHandler(AppDbContext context, IModuleService moduleService)
    {
        _context = context;
        _moduleService = moduleService;
    }

    public async Task<ModuleRecordDto> Handle(GetRecordQuery request, CancellationToken cancellationToken)
    {
        var record = await _context.ModuleRecords
            .Include(r => r.Module)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.RecordId && r.ModuleId == request.ModuleId, cancellationToken);

        if (record == null)
        {
            throw new KeyNotFoundException($"Record with ID {request.RecordId} not found in module {request.ModuleId}.");
        }

        var count = await _context.RecordRelations
            .CountAsync(r => r.TargetModule == record.Module.Name && r.TargetRecordId == record.Id, cancellationToken);

        return new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = _moduleService.DeserializeData(record.Data),
            LinkedCount = count,
            CreatedAt = record.CreatedAt
        };
    }
}
