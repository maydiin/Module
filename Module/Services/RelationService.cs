using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using System.Text.Json;

namespace Module.Services;

public class RelationService : IRelationService
{
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;

    public RelationService(AppDbContext context, IModuleService moduleService)
    {
        _context = context;
        _moduleService = moduleService;
    }

    public async Task SaveRelations(string sourceModule, int sourceId, ModuleRecord record)
    {
        // Delete old relations for this source
        await DeleteRelationsForSource(sourceModule, sourceId);

        var data = _moduleService.DeserializeData(record.Data);
        var fields = await _context.ModuleFields
            .Where(f => f.ModuleId == record.ModuleId && (f.Type == "relation" || f.Type == "multiselect-relation"))
            .ToListAsync();

        var newRelations = new List<RecordRelation>();

        foreach (var field in fields)
        {
            if (data.TryGetValue(field.Name, out var value) && value != null)
            {
                var targetModule = field.Options?.Trim('\"');
                if (string.IsNullOrEmpty(targetModule)) continue;

                var targetIds = new List<int>();
                if (value is JsonElement element)
                {
                    if (element.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in element.EnumerateArray())
                        {
                            if (item.TryGetInt32(out var id)) targetIds.Add(id);
                        }
                    }
                    else if (element.ValueKind == JsonValueKind.Number)
                    {
                        if (element.TryGetInt32(out var id)) targetIds.Add(id);
                    }
                    else if (element.ValueKind == JsonValueKind.String && int.TryParse(element.GetString(), out var sId))
                    {
                        targetIds.Add(sId);
                    }
                }
                else if (value is ICollection<int> intList)
                {
                    targetIds.AddRange(intList);
                }
                else if (int.TryParse(value.ToString(), out var id))
                {
                    targetIds.Add(id);
                }

                foreach (var targetId in targetIds.Distinct())
                {
                    newRelations.Add(new RecordRelation
                    {
                        SourceModule = sourceModule,
                        SourceRecordId = sourceId,
                        TargetModule = targetModule,
                        TargetRecordId = targetId,
                        FieldName = field.Name
                    });
                }
            }
        }

        if (newRelations.Any())
        {
            _context.RecordRelations.AddRange(newRelations);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<List<RelationDto>> GetUsedIn(string targetModule, int targetId)
    {
        var relations = await _context.RecordRelations
            .Where(r => r.TargetModule == targetModule && r.TargetRecordId == targetId)
            .ToListAsync();

        var result = new List<RelationDto>();

        foreach (var group in relations.GroupBy(r => r.SourceModule))
        {
            var sourceModuleName = group.Key;
            var recordIds = group.Select(r => r.SourceRecordId).Distinct().ToList();

            var records = await _context.ModuleRecords
                .Include(r => r.Module)
                .ThenInclude(m => m.Fields)
                .Where(r => r.Module.Name == sourceModuleName && recordIds.Contains(r.Id))
                .ToListAsync();

            foreach (var record in records)
            {
                var data = _moduleService.DeserializeData(record.Data);
                var displayValue = record.Id.ToString();

                // Find first text field for display
                var displayField = record.Module.Fields
                    .OrderBy(f => f.OrderNo)
                    .FirstOrDefault(f => f.Type == "text");

                if (displayField != null && data.TryGetValue(displayField.Name, out var val) && val != null)
                {
                    displayValue = val.ToString() ?? record.Id.ToString();
                }

                result.Add(new RelationDto
                {
                    Module = sourceModuleName,
                    RecordId = record.Id,
                    Display = displayValue
                });
            }
        }

        return result;
    }

    public async Task DeleteRelationsForSource(string sourceModule, int sourceId)
    {
        var oldRelations = await _context.RecordRelations
            .Where(r => r.SourceModule == sourceModule && r.SourceRecordId == sourceId)
            .ToListAsync();

        if (oldRelations.Any())
        {
            _context.RecordRelations.RemoveRange(oldRelations);
            await _context.SaveChangesAsync();
        }
    }
}
