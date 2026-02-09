using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Services;
using System.Text.Json;

namespace Module.Features.Records.Commands;

public record UpdateRecordCommand(int ModuleId, int RecordId, Dictionary<string, object> Data) : ICommand<ModuleRecordDto>;

public class UpdateRecordHandler : IRequestHandler<UpdateRecordCommand, ModuleRecordDto>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;

    public UpdateRecordHandler(AppDbContext context, IModuleService moduleService, IRelationService relationService)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
    }

    public async Task<ModuleRecordDto> Handle(UpdateRecordCommand request, CancellationToken cancellationToken)
    {
        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == request.RecordId && r.ModuleId == request.ModuleId, cancellationToken);
        
        if (record == null)
        {
            throw new KeyNotFoundException($"Record with ID {request.RecordId} not found in module {request.ModuleId}.");
        }

        // 1. Serialize Data
        var json = JsonSerializer.Serialize(request.Data);

        // 2. Update Record Entity
        record.Data = json;
        // Optimization: Handle UpdatedAt if needed in future

        await _context.SaveChangesAsync(cancellationToken);

        // 3. Handle Relations
        var module = await _context.Modules.FindAsync(new object[] { request.ModuleId }, cancellationToken);
        var linkedCount = 0;
        
        if (module != null)
        {
            await _relationService.SaveRelations(module.Name, record.Id, record);
            
            linkedCount = await _context.RecordRelations
                .CountAsync(r => r.TargetModule == module.Name && r.TargetRecordId == record.Id, cancellationToken);
        }

        // 4. Return DTO
        return new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = _moduleService.DeserializeData(record.Data),
            LinkedCount = linkedCount,
            CreatedAt = record.CreatedAt
        };
    }
}
