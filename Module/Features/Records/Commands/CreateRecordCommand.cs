using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;
using Module.FieldTypes;
using System.Text.Json;
using System.Text.Json;

namespace Module.Features.Records.Commands;

public record CreateRecordCommand(int ModuleId, Dictionary<string, object> Data) : ICommand<ModuleRecordDto>;

public class CreateRecordHandler : IRequestHandler<CreateRecordCommand, ModuleRecordDto>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly FieldTypeFactory _fieldTypeFactory;
    private readonly ITenantService _tenantService;

    public CreateRecordHandler(AppDbContext context, IModuleService moduleService, IRelationService relationService, FieldTypeFactory fieldTypeFactory, ITenantService tenantService)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _fieldTypeFactory = fieldTypeFactory;
        _tenantService = tenantService;
    }

    public async Task<ModuleRecordDto> Handle(CreateRecordCommand request, CancellationToken cancellationToken)
    {
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
        // Ordered by OrderNo to ensure dependencies are calculated first (e.g. totalsatis before toplamkar)
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

        // 2. Create Record Entity
        var record = new ModuleRecord
        {
            ModuleId = request.ModuleId,
            Data = json,
            CreatedAt = DateTime.UtcNow,
            TenantId = _tenantService.GetCurrentTenantId()
        };

        _context.ModuleRecords.Add(record);
        await _context.SaveChangesAsync(cancellationToken);

        // 3. Handle Relations (This could be moved to an event handler later)
        await _relationService.SaveRelations(module.Name, record.Id, record);

        // 4. Return DTO with runtime-computed fields
        var resultData = _moduleService.DeserializeData(record.Data);
        await _relationService.EnrichWithDisplayValuesAsync(module, new List<Dictionary<string, object>> { resultData });
        _moduleService.ComputeFormulas(module, resultData);
        
        return new ModuleRecordDto
        {
            Id = record.Id,
            ModuleId = record.ModuleId,
            Data = resultData,
            CreatedAt = record.CreatedAt
        };
    }
}
