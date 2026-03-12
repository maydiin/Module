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

                var displayFields = record.Module.Fields
                    .Where(f => f.IsDisplayField)
                    .OrderBy(f => f.OrderNo)
                    .ToList();

                if (displayFields.Any())
                {
                    var values = new List<string>();
                    foreach (var f in displayFields)
                    {
                        if (data.TryGetValue($"__display_{f.Name}", out var displayVal) && displayVal != null && !string.IsNullOrWhiteSpace(displayVal.ToString()))
                        {
                            values.Add(displayVal.ToString()!);
                        }
                        else if (data.TryGetValue(f.Name, out var val) && val != null && !string.IsNullOrWhiteSpace(val.ToString()))
                        {
                            values.Add(val.ToString()!);
                        }
                    }
                    if (values.Any())
                    {
                        displayValue = string.Join(" - ", values);
                    }
                }
                else
                {
                    // Find first text field for display fallback
                    var displayField = record.Module.Fields
                        .OrderBy(f => f.OrderNo)
                        .FirstOrDefault(f => f.Type == "text");

                    if (displayField != null && data.TryGetValue(displayField.Name, out var val) && val != null)
                    {
                        displayValue = val.ToString() ?? record.Id.ToString();
                    }
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
    public async Task<List<RelationSummaryDto>> GetRelationSummary(string targetModule, int targetId)
    {
        return await _context.RecordRelations
            .Where(r => r.TargetModule == targetModule && r.TargetRecordId == targetId)
            .GroupBy(r => r.SourceModule)
            .Select(g => new RelationSummaryDto
            {
                Module = g.Key,
                Count = g.Count()
            })
            .ToListAsync();
    }

    public async Task<List<RelationDto>> GetRelatedRecords(string targetModule, int targetId, string sourceModule, int page, int pageSize)
    {
        var relations = await _context.RecordRelations
            .Where(r => r.TargetModule == targetModule && r.TargetRecordId == targetId && r.SourceModule == sourceModule)
            .OrderBy(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        if (!relations.Any())
            return new List<RelationDto>();

        var recordIds = relations.Select(r => r.SourceRecordId).Distinct().ToList();

        var records = await _context.ModuleRecords
            .Include(r => r.Module)
            .ThenInclude(m => m.Fields)
            .Where(r => r.Module.Name == sourceModule && recordIds.Contains(r.Id))
            .ToListAsync();

        var result = new List<RelationDto>();

        foreach (var relation in relations)
        {
            var record = records.FirstOrDefault(r => r.Id == relation.SourceRecordId);
            if (record == null) continue;

            var data = _moduleService.DeserializeData(record.Data);
            var displayValue = record.Id.ToString();

            var displayFields = record.Module.Fields
                .Where(f => f.IsDisplayField)
                .OrderBy(f => f.OrderNo)
                .ToList();

            if (displayFields.Any())
            {
                var values = new List<string>();
                foreach (var f in displayFields)
                {
                    if (data.TryGetValue($"__display_{f.Name}", out var displayVal) && displayVal != null && !string.IsNullOrWhiteSpace(displayVal.ToString()))
                    {
                        values.Add(displayVal.ToString()!);
                    }
                    else if (data.TryGetValue(f.Name, out var val) && val != null && !string.IsNullOrWhiteSpace(val.ToString()))
                    {
                        values.Add(val.ToString()!);
                    }
                }
                if (values.Any())
                {
                    displayValue = string.Join(" - ", values);
                }
            }
            else
            {
                // Find first text field for display fallback
                var displayField = record.Module.Fields
                    .OrderBy(f => f.OrderNo)
                    .FirstOrDefault(f => f.Type == "text");

                if (displayField != null && data.TryGetValue(displayField.Name, out var val) && val != null)
                {
                    displayValue = val.ToString() ?? record.Id.ToString();
                }
            }

            result.Add(new RelationDto
            {
                Module = sourceModule,
                RecordId = record.Id,
                Display = displayValue
            });
        }

        return result;
    }

    public async Task EnrichWithDisplayValuesAsync(Entities.Module module, List<Dictionary<string, object>> recordsData)
    {
        var relationFields = module.Fields.Where(f => f.Type == "relation" || f.Type == "multiselect-relation").ToList();
        if (!relationFields.Any() || !recordsData.Any()) return;
        
        var targetRecordIds = new Dictionary<string, HashSet<int>>(); 
        
        foreach (var data in recordsData)
        {
            foreach (var field in relationFields)
            {
                if (string.IsNullOrWhiteSpace(field.Options)) continue;
                var targetModule = field.Options.Trim('\"');
                
                if (data.TryGetValue(field.Name, out var val) && val != null)
                {
                    if (!targetRecordIds.ContainsKey(targetModule)) targetRecordIds[targetModule] = new HashSet<int>();
                    
                    if (val is JsonElement el)
                    {
                        if (el.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in el.EnumerateArray())
                                if (item.TryGetInt32(out var tid)) targetRecordIds[targetModule].Add(tid);
                        }
                        else if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var tid))
                        {
                            targetRecordIds[targetModule].Add(tid);
                        }
                    }
                    else if (int.TryParse(val.ToString(), out var tid))
                    {
                        targetRecordIds[targetModule].Add(tid);
                    }
                }
            }
        }
        
        var displayValuesMap = new Dictionary<string, Dictionary<int, string>>();
        foreach (var kvp in targetRecordIds)
        {
            var targetModule = kvp.Key;
            var ids = kvp.Value.ToList();
            if (!ids.Any()) continue;
            
            var targetRecords = await _context.ModuleRecords
                .Include(tr => tr.Module)
                .ThenInclude(trM => trM.Fields)
                .Where(tr => tr.Module.Name == targetModule && ids.Contains(tr.Id))
                .ToListAsync();
                
            displayValuesMap[targetModule] = new Dictionary<int, string>();
            foreach (var tr in targetRecords)
            {
                var trData = _moduleService.DeserializeData(tr.Data);
                var displayFields = tr.Module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
                string displayStr = tr.Id.ToString();
                
                if (displayFields.Any())
                {
                    var vals = new List<string>();
                    foreach (var df in displayFields)
                    {
                         if (trData.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                             vals.Add(dfVal.ToString()!);
                    }
                    if (vals.Any()) displayStr = string.Join(" - ", vals);
                }
                else
                {
                     var fallbackField = tr.Module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
                     if (fallbackField != null && trData.TryGetValue(fallbackField.Name, out var val) && val != null)
                         displayStr = val.ToString() ?? tr.Id.ToString();
                }
                
                displayValuesMap[targetModule][tr.Id] = displayStr;
            }
        }

        foreach (var data in recordsData)
        {
            foreach (var field in relationFields)
            {
                if (string.IsNullOrWhiteSpace(field.Options)) continue;
                var targetModule = field.Options.Trim('\"');
                if (!displayValuesMap.ContainsKey(targetModule)) continue;
                
                if (data.TryGetValue(field.Name, out var val) && val != null)
                {
                    var displayStrings = new List<string>();
                    
                    if (val is JsonElement el)
                    {
                        if (el.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in el.EnumerateArray())
                                if (item.TryGetInt32(out var tid) && displayValuesMap[targetModule].ContainsKey(tid)) 
                                    displayStrings.Add(displayValuesMap[targetModule][tid]);
                        }
                        else if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var tid) && displayValuesMap[targetModule].ContainsKey(tid))
                        {
                            displayStrings.Add(displayValuesMap[targetModule][tid]);
                        }
                    }
                    else if (int.TryParse(val.ToString(), out var tid) && displayValuesMap[targetModule].ContainsKey(tid))
                    {
                        displayStrings.Add(displayValuesMap[targetModule][tid]);
                    }
                    
                    if (displayStrings.Any())
                    {
                        data[$"__display_{field.Name}"] = string.Join(", ", displayStrings);
                    }
                }
            }
        }
    }
}
