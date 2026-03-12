using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Services;
using Module.FieldTypes;
using System.Text.Json;

namespace Module.Features.Records.Commands;

public record UpdateRecordCommand(int ModuleId, int RecordId, Dictionary<string, object> Data) : ICommand<ModuleRecordDto>;

public class UpdateRecordHandler : IRequestHandler<UpdateRecordCommand, ModuleRecordDto>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly FieldTypeFactory _fieldTypeFactory;

    public UpdateRecordHandler(AppDbContext context, IModuleService moduleService, IRelationService relationService, FieldTypeFactory fieldTypeFactory)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _fieldTypeFactory = fieldTypeFactory;
    }

    public async Task<ModuleRecordDto> Handle(UpdateRecordCommand request, CancellationToken cancellationToken)
    {
        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == request.RecordId && r.ModuleId == request.ModuleId, cancellationToken);
        
        if (record == null)
        {
            throw new KeyNotFoundException($"Record with ID {request.RecordId} not found in module {request.ModuleId}.");
        }

        var module = await _context.Modules
            .Include(m => m.Fields)
            .FirstOrDefaultAsync(m => m.Id == request.ModuleId, cancellationToken);
            
        if (module == null)
        {
             throw new KeyNotFoundException($"Module with ID {request.ModuleId} not found.");
        }

        // 0. Initial Validation (Required fields, etc.)
        var errors = await _moduleService.ValidateDataAsync(request.ModuleId, request.Data);
        if (errors.Any())
        {
            throw new Module.Common.Exceptions.ValidationException(string.Join(", ", errors));
        }

        // 0. Compute All Fields First
        // Ordered by OrderNo to ensure dependencies are calculated first
        foreach (var field in module.Fields.OrderBy(f => f.OrderNo))
        {
            try
            {
                // Ensure manual values are removed so they can't be set if formula fails
                if (field.Type == "formula")
                {
                    request.Data.Remove(field.Name);
                }

                var fieldType = _fieldTypeFactory.Get(field.Type);
                var computedValue = fieldType.Compute(field, request.Data);
                
                if (computedValue != null)
                {
                    // Add to data so subsequent formulas can use it (even if it's not stored later)
                    request.Data[field.Name] = computedValue;
                }
            }
            catch (ArgumentException)
            {
                // Verify if field type is supported, if not, ignore
            }
        }

        // 0.1 Clean up non-stored formula fields before saving
        foreach (var field in module.Fields)
        {
            if (field.Type == "formula" && !field.IsStored)
            {
                request.Data.Remove(field.Name);
            }
        }

        // 1. Serialize Data
        var json = JsonSerializer.Serialize(request.Data);

        // 2. Update Record Entity
        record.Data = json;
        // Optimization: Handle UpdatedAt if needed in future

        await _context.SaveChangesAsync(cancellationToken);

        // 3. Handle Relations
        var linkedCount = 0;
        
        if (module != null)
        {
            await _relationService.SaveRelations(module.Name, record.Id, record);
            
            linkedCount = await _context.RecordRelations
                .CountAsync(r => r.TargetModule == module.Name && r.TargetRecordId == record.Id, cancellationToken);
        }

        // 4. Return DTO with runtime-computed fields
        var resultData = _moduleService.DeserializeData(record.Data);
        await _relationService.EnrichWithDisplayValuesAsync(module, new List<Dictionary<string, object>> { resultData });
        _moduleService.ComputeFormulas(module, resultData);
        
        return new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = resultData,
            LinkedCount = linkedCount,
            CreatedAt = record.CreatedAt
        };
    }
}
