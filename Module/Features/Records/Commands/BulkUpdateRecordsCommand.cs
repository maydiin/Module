using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;
using Module.FieldTypes;
using System.Text.Json;

namespace Module.Features.Records.Commands;

public record BulkUpdateItem(int Id, Dictionary<string, object> Data);

public record BulkUpdateRecordsCommand(int ModuleId, List<BulkUpdateItem> Updates) : ICommand<List<ModuleRecordDto>>;

public class BulkUpdateRecordsHandler : IRequestHandler<BulkUpdateRecordsCommand, List<ModuleRecordDto>>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly FieldTypeFactory _fieldTypeFactory;

    public BulkUpdateRecordsHandler(AppDbContext context, IModuleService moduleService, IRelationService relationService, FieldTypeFactory fieldTypeFactory)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _fieldTypeFactory = fieldTypeFactory;
    }

    public async Task<List<ModuleRecordDto>> Handle(BulkUpdateRecordsCommand request, CancellationToken cancellationToken)
    {
        var module = await _context.Modules
            .Include(m => m.Fields)
            .FirstOrDefaultAsync(m => m.Id == request.ModuleId, cancellationToken);

        if (module == null)
        {
            throw new KeyNotFoundException($"Module with ID {request.ModuleId} not found.");
        }

        var results = new List<ModuleRecordDto>();
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            foreach (var update in request.Updates)
            {
                var record = await _context.ModuleRecords
                    .FirstOrDefaultAsync(r => r.Id == update.Id && r.ModuleId == request.ModuleId, cancellationToken);

                if (record == null)
                {
                    throw new KeyNotFoundException($"Record with ID {update.Id} not found in module {request.ModuleId}.");
                }

                // 1. Validation
                var errors = await _moduleService.ValidateDataAsync(request.ModuleId, update.Data);
                if (errors.Any())
                {
                    throw new Module.Common.Exceptions.ValidationException($"Validation failed for record ID {update.Id}: {string.Join(", ", errors)}");
                }

                // 2. Compute Formulas
                foreach (var field in module.Fields.OrderBy(f => f.OrderNo))
                {
                    if (field.Type == "formula")
                    {
                        update.Data.Remove(field.Name);
                        var fieldType = _fieldTypeFactory.Get(field.Type);
                        var computedValue = fieldType.Compute(field, update.Data);
                        if (computedValue != null) update.Data[field.Name] = computedValue;
                    }
                }

                // Clean up non-stored formulas
                foreach (var field in module.Fields)
                {
                    if (field.Type == "formula" && !field.IsStored) update.Data.Remove(field.Name);
                }

                // 3. Update Entity
                record.Data = JsonSerializer.Serialize(update.Data);
                await _context.SaveChangesAsync(cancellationToken);

                // 4. Relations
                await _relationService.SaveRelations(module.Name, record.Id, record);
                var linkedCount = await _context.RecordRelations
                    .CountAsync(r => r.TargetModule == module.Name && r.TargetRecordId == record.Id, cancellationToken);

                // 5. Result DTO
                var resultData = _moduleService.DeserializeData(record.Data);
                foreach (var field in module.Fields.Where(f => !f.IsStored && f.Type == "formula"))
                {
                    try
                    {
                        var fieldType = _fieldTypeFactory.Get(field.Type);
                        var computedValue = fieldType.Compute(field, resultData);
                        if (computedValue != null) resultData[field.Name] = computedValue;
                    }
                    catch { }
                }

                results.Add(new ModuleRecordDto
                {
                    Id = record.Id,
                    ModuleId = record.ModuleId,
                    Data = resultData,
                    LinkedCount = linkedCount,
                    CreatedAt = record.CreatedAt
                });
            }

            await transaction.CommitAsync(cancellationToken);
            return results;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
