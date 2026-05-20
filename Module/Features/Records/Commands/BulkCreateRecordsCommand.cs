using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;
using Module.Services.Caching;
using Module.FieldTypes;
using System.Text.Json;

namespace Module.Features.Records.Commands;

public record BulkCreateRecordsCommand(int ModuleId, List<Dictionary<string, object>> RecordsData, int? CreatedByUserId = null) : ICommand<List<ModuleRecordDto>>;

public class BulkCreateRecordsHandler : IRequestHandler<BulkCreateRecordsCommand, List<ModuleRecordDto>>
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly FieldTypeFactory _fieldTypeFactory;
    private readonly ITenantService _tenantService;
    private readonly IModuleCacheService _moduleCacheService;

    public BulkCreateRecordsHandler(AppDbContext context, IModuleService moduleService, IRelationService relationService, FieldTypeFactory fieldTypeFactory, ITenantService tenantService, IModuleCacheService moduleCacheService)
    {
        _context = context;
        _moduleService = moduleService;
        _relationService = relationService;
        _fieldTypeFactory = fieldTypeFactory;
        _tenantService = tenantService;
        _moduleCacheService = moduleCacheService;
    }

    public async Task<List<ModuleRecordDto>> Handle(BulkCreateRecordsCommand request, CancellationToken cancellationToken)
    {
        var module = await _moduleCacheService.GetModuleAsync(request.ModuleId);

        if (module == null)
        {
            throw new KeyNotFoundException($"Module with ID {request.ModuleId} not found.");
        }

        var results = new List<ModuleRecordDto>();
        var tenantId = _tenantService.GetCurrentTenantId();

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            foreach (var data in request.RecordsData)
            {
                // 1. Validation
                var errors = await _moduleService.ValidateDataAsync(request.ModuleId, data);
                if (errors.Any())
                {
                    throw new Module.Common.Exceptions.ValidationException($"Validation failed for a record: {string.Join(", ", errors)}");
                }

                // 2. Compute Formula Fields
                foreach (var field in module.Fields.OrderBy(f => f.OrderNo))
                {
                    if (field.Type == "formula")
                    {
                        data.Remove(field.Name);
                        var fieldType = _fieldTypeFactory.Get(field.Type);
                        var computedValue = fieldType.Compute(field, data);
                        if (computedValue != null)
                        {
                            data[field.Name] = computedValue;
                        }
                    }
                }

                // Clean up non-stored formulas
                foreach (var field in module.Fields)
                {
                    if (field.Type == "formula" && !field.IsStored)
                    {
                        data.Remove(field.Name);
                    }
                }

                // 3. Create Entity
                var record = new ModuleRecord
                {
                    ModuleId = request.ModuleId,
                    Data = JsonSerializer.Serialize(data),
                    CreatedAt = DateTime.UtcNow,
                    TenantId = tenantId,
                    CreatedByUserId = request.CreatedByUserId
                };

                _context.ModuleRecords.Add(record);
                await _context.SaveChangesAsync(cancellationToken);

                // 4. Relations
                await _relationService.SaveRelations(module.Name, record.Id, record);

                // 5. Prepare Result DTO (with runtime formulas)
                var resultData = _moduleService.DeserializeData(record.Data);
                foreach (var field in module.Fields.Where(f => !f.IsStored && f.Type == "formula"))
                {
                    try
                    {
                        var fieldType = _fieldTypeFactory.Get(field.Type);
                        var computedValue = fieldType.Compute(field, resultData);
                        if (computedValue != null) resultData[field.Name] = computedValue;
                    }
                    catch { /* ignore */ }
                }

                results.Add(new ModuleRecordDto
                {
                    Id = record.Id,
                    ModuleId = record.ModuleId,
                    Data = resultData,
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
