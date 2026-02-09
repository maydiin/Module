using MediatR;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;
using System.Text.Json;

namespace Module.Features.Records.Commands;

public record CreateRecordCommand(int ModuleId, Dictionary<string, object> Data) : ICommand<ModuleRecordDto>;

public class CreateRecordHandler : IRequestHandler<CreateRecordCommand, ModuleRecordDto>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;

    public CreateRecordHandler(AppDbContext context, IModuleService moduleService, IRelationService relationService)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
    }

    public async Task<ModuleRecordDto> Handle(CreateRecordCommand request, CancellationToken cancellationToken)
    {
        var module = await _context.Modules.FindAsync(new object[] { request.ModuleId }, cancellationToken);
        if (module == null)
        {
            throw new KeyNotFoundException($"Module with ID {request.ModuleId} not found.");
        }

        // 1. Serialize Data
        var json = JsonSerializer.Serialize(request.Data);

        // 2. Create Record Entity
        var record = new ModuleRecord
        {
            ModuleId = request.ModuleId,
            Data = json,
            CreatedAt = DateTime.UtcNow
        };

        _context.ModuleRecords.Add(record);
        await _context.SaveChangesAsync(cancellationToken);

        // 3. Handle Relations (This could be moved to an event handler later)
        await _relationService.SaveRelations(module.Name, record.Id, record);

        // 4. Return DTO
        return new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = _moduleService.DeserializeData(record.Data)
        };
    }
}
