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
        // 1. Find all "relations" (One-to-Many subgrid) fields for this parent module
        var relationsFields = await _context.ModuleFields
            .Where(f => f.ModuleId == record.ModuleId && f.Type == "relations")
            .ToListAsync();

        // 2. Fetch existing relations for these specific fields before we delete them
        var relationsFieldNames = relationsFields.Select(f => f.Name).ToList();
        var existingChildRelations = await _context.RecordRelations
            .Where(r => r.SourceModule == sourceModule && r.SourceRecordId == sourceId && relationsFieldNames.Contains(r.FieldName))
            .ToListAsync();

        // Delete old relations (simple relations will be fully recreated, and relations relations will be selective)
        await DeleteRelationsForSource(sourceModule, sourceId);

        var data = _moduleService.DeserializeData(record.Data);
        var activeRelations = new List<RecordRelation>();

        // 3. Process relations (subgrid) fields
        foreach (var field in relationsFields)
        {
            if (data.TryGetValue(field.Name, out var value) && value != null)
            {
                var targetModule = field.Options?.Trim('\"');
                if (string.IsNullOrEmpty(targetModule)) continue;

                var targetModuleEntity = await _context.Modules.FirstOrDefaultAsync(m => m.Name == targetModule);
                if (targetModuleEntity == null) continue;

                var childRecords = new List<Dictionary<string, object>>();
                if (value is JsonElement element && element.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in element.EnumerateArray())
                    {
                        var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(item.GetRawText());
                        if (dict != null) childRecords.Add(dict);
                    }
                }
                else if (value is IEnumerable<Dictionary<string, object>> dictEnumerable)
                {
                    childRecords.AddRange(dictEnumerable);
                }

                var activeChildIds = new List<int>();
                foreach (var childRecord in childRecords)
                {
                    int childId = 0;
                    if (childRecord.TryGetValue("id", out var idVal) || childRecord.TryGetValue("Id", out idVal))
                    {
                        if (idVal is JsonElement idEl && idEl.ValueKind == JsonValueKind.Number)
                        {
                            idEl.TryGetInt32(out childId);
                        }
                        else if (int.TryParse(idVal.ToString(), out var parsedId))
                        {
                            childId = parsedId;
                        }
                    }

                    // Strip metadata/display keys before serializing JSON
                    childRecord.Remove("id");
                    childRecord.Remove("Id");
                    childRecord.Remove("__display");

                    var keysToRemove = childRecord.Keys.Where(k => k.StartsWith("__display_") || k.StartsWith("__links_")).ToList();
                    foreach (var k in keysToRemove) childRecord.Remove(k);

                    // Compute formulas on child record
                    _moduleService.ComputeFormulas(targetModuleEntity, childRecord);
                    var childJson = JsonSerializer.Serialize(childRecord);

                    if (childId > 0)
                    {
                        // Update existing child record
                        var childRecordEntity = await _context.ModuleRecords.FindAsync(childId);
                        if (childRecordEntity != null)
                        {
                            childRecordEntity.Data = childJson;
                            _context.ModuleRecords.Update(childRecordEntity);
                            activeChildIds.Add(childId);
                        }
                    }
                    else
                    {
                        // Create new child record
                        var newChild = new ModuleRecord
                        {
                            ModuleId = targetModuleEntity.Id,
                            Data = childJson,
                            CreatedAt = DateTime.UtcNow,
                            TenantId = record.TenantId,
                            CreatedByUserId = record.CreatedByUserId
                        };
                        _context.ModuleRecords.Add(newChild);
                        await _context.SaveChangesAsync(); // Save to generate ID
                        activeChildIds.Add(newChild.Id);
                    }
                }

                // Orphan Cleanup: Delete child records that are no longer present in the updated collection
                var fieldExistingRelations = existingChildRelations.Where(r => r.FieldName == field.Name).ToList();
                foreach (var rel in fieldExistingRelations)
                {
                    if (!activeChildIds.Contains(rel.TargetRecordId))
                    {
                        var orphanedRecord = await _context.ModuleRecords.FindAsync(rel.TargetRecordId);
                        if (orphanedRecord != null)
                        {
                            _context.ModuleRecords.Remove(orphanedRecord);
                        }
                    }
                }

                // Re-build child relations
                foreach (var childId in activeChildIds)
                {
                    activeRelations.Add(new RecordRelation
                    {
                        SourceModule = sourceModule,
                        SourceRecordId = sourceId,
                        TargetModule = targetModule,
                        TargetRecordId = childId,
                        FieldName = field.Name
                    });
                }
            }
            else
            {
                // If sub-grid was emptied, clean up all its previous child records
                var fieldExistingRelations = existingChildRelations.Where(r => r.FieldName == field.Name).ToList();
                foreach (var rel in fieldExistingRelations)
                {
                    var orphanedRecord = await _context.ModuleRecords.FindAsync(rel.TargetRecordId);
                    if (orphanedRecord != null)
                    {
                        _context.ModuleRecords.Remove(orphanedRecord);
                    }
                }
            }
        }

        // 4. Process standard relation fields
        var standardFields = await _context.ModuleFields
            .Where(f => f.ModuleId == record.ModuleId && (f.Type == "relation" || f.Type == "multiselect-relation"))
            .ToListAsync();

        var newRelations = new List<RecordRelation>();

        foreach (var field in standardFields)
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

        // Combine standard relations and relations relations
        newRelations.AddRange(activeRelations);

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
                    ModuleId = record.ModuleId,
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
        var allRelations = await _context.RecordRelations
            .Where(r => (r.TargetModule == targetModule && r.TargetRecordId == targetId) || 
                        (r.SourceModule == targetModule && r.SourceRecordId == targetId))
            .ToListAsync();

        var result = new List<RelationSummaryDto>();
        var groups = allRelations.GroupBy(r => 
            r.TargetModule == targetModule && r.TargetRecordId == targetId ? r.SourceModule : r.TargetModule);

        foreach (var g in groups)
        {
            result.Add(new RelationSummaryDto
            {
                Module = g.Key,
                Count = g.Count()
            });
        }

        return result;
    }

    public async Task<List<RelationDto>> GetRelatedRecords(string targetModule, int targetId, string sourceModule, int page, int pageSize)
    {
        var relations = await _context.RecordRelations
            .Where(r => (r.TargetModule == targetModule && r.TargetRecordId == targetId && r.SourceModule == sourceModule) ||
                        (r.SourceModule == targetModule && r.SourceRecordId == targetId && r.TargetModule == sourceModule))
            .OrderBy(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        if (!relations.Any())
            return new List<RelationDto>();

        var recordIds = relations.Select(r => 
            r.TargetModule == targetModule && r.TargetRecordId == targetId ? r.SourceRecordId : r.TargetRecordId)
            .Distinct()
            .ToList();

        var records = await _context.ModuleRecords
            .Include(r => r.Module)
            .ThenInclude(m => m.Fields)
            .Where(r => r.Module.Name == sourceModule && recordIds.Contains(r.Id))
            .ToListAsync();

        var result = new List<RelationDto>();

        foreach (var relation in relations)
        {
            var relRecordId = relation.TargetModule == targetModule && relation.TargetRecordId == targetId ? relation.SourceRecordId : relation.TargetRecordId;
            var record = records.FirstOrDefault(r => r.Id == relRecordId);
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
                ModuleId = record.ModuleId,
                RecordId = record.Id,
                Display = displayValue
            });
        }

        return result;
    }

    public async Task EnrichWithDisplayValuesAsync(Entities.Module module, List<Dictionary<string, object>> recordsData)
    {
        // 1. Handle standard simple relation and multiselect relation fields
        var relationFields = module.Fields.Where(f => f.Type == "relation" || f.Type == "multiselect-relation").ToList();
        if (relationFields.Any() && recordsData.Any())
        {
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
            
            var targetInfoMap = new Dictionary<string, Dictionary<int, (string display, int moduleId)>>();
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
                    
                targetInfoMap[targetModule] = new Dictionary<int, (string display, int moduleId)>();
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
                    
                    targetInfoMap[targetModule][tr.Id] = (displayStr, tr.ModuleId);
                }
            }

            foreach (var data in recordsData)
            {
                foreach (var field in relationFields)
                {
                    if (string.IsNullOrWhiteSpace(field.Options)) continue;
                    var targetModule = field.Options.Trim('\"');
                    if (!targetInfoMap.ContainsKey(targetModule)) continue;
                    
                    if (data.TryGetValue(field.Name, out var val) && val != null)
                    {
                        var displayStrings = new List<string>();
                        var links = new List<object>();
                        
                        var idsToLookup = new List<int>();
                        if (val is JsonElement el)
                        {
                            if (el.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var item in el.EnumerateArray())
                                    if (item.TryGetInt32(out var tid)) idsToLookup.Add(tid);
                            }
                            else if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var tid))
                            {
                                idsToLookup.Add(tid);
                            }
                        }
                        else if (int.TryParse(val.ToString(), out var tid))
                        {
                            idsToLookup.Add(tid);
                        }

                        foreach (var tid in idsToLookup)
                        {
                            if (targetInfoMap[targetModule].TryGetValue(tid, out var info))
                            {
                                displayStrings.Add(info.display);
                                links.Add(new { moduleId = info.moduleId, recordId = tid, display = info.display });
                            }
                        }
                        
                        if (displayStrings.Any())
                        {
                            data[$"__display_{field.Name}"] = string.Join(", ", displayStrings);
                            data[$"__links_{field.Name}"] = links;
                        }
                    }
                }
            }
        }

        // 2. Handle subgrid relations (One-to-Many relations fields)
        var relationsFields = module.Fields.Where(f => f.Type == "relations").ToList();
        if (relationsFields.Any() && recordsData.Any())
        {
            var parentIds = recordsData
                .Where(d => d.ContainsKey("id"))
                .Select(d => Convert.ToInt32(d["id"]))
                .ToList();

            if (parentIds.Any())
            {
                var relationsFieldNames = relationsFields.Select(f => f.Name).ToList();
                var allRelations = await _context.RecordRelations
                    .Where(r => r.SourceModule == module.Name && relationsFieldNames.Contains(r.FieldName) && parentIds.Contains(r.SourceRecordId))
                    .ToListAsync();

                var allChildIds = allRelations.Select(r => r.TargetRecordId).Distinct().ToList();

                if (allChildIds.Any())
                {
                    var allChildRecords = await _context.ModuleRecords
                        .Include(cr => cr.Module)
                        .ThenInclude(crM => crM.Fields)
                        .Where(cr => allChildIds.Contains(cr.Id))
                        .ToListAsync();

                    var childInfoMap = allChildRecords.ToDictionary(cr => cr.Id);

                    foreach (var data in recordsData)
                    {
                        if (!data.TryGetValue("id", out var pidVal)) continue;
                        var parentId = Convert.ToInt32(pidVal);

                        foreach (var field in relationsFields)
                        {
                            var targetModule = field.Options?.Trim('\"');
                            if (string.IsNullOrEmpty(targetModule)) continue;

                            var fieldRelations = allRelations
                                .Where(r => r.SourceRecordId == parentId && r.FieldName == field.Name)
                                .ToList();

                            var childRecordList = new List<Dictionary<string, object>>();

                            foreach (var rel in fieldRelations)
                            {
                                if (childInfoMap.TryGetValue(rel.TargetRecordId, out var cr))
                                {
                                    var crData = _moduleService.DeserializeData(cr.Data);
                                    crData["id"] = cr.Id;
                                    crData["Id"] = cr.Id;

                                    // Recursively enrich each child record's own display values/relations!
                                    await EnrichWithDisplayValuesAsync(cr.Module, new List<Dictionary<string, object>> { crData });
                                    _moduleService.ComputeFormulas(cr.Module, crData);

                                    childRecordList.Add(crData);
                                }
                            }

                            data[field.Name] = childRecordList;
                        }
                    }
                }
                else
                {
                    // Initialize as empty arrays if no subgrid relations exist
                    foreach (var data in recordsData)
                    {
                        foreach (var field in relationsFields)
                        {
                            if (!data.ContainsKey(field.Name) || data[field.Name] == null)
                            {
                                data[field.Name] = new List<Dictionary<string, object>>();
                            }
                        }
                    }
                }
            }
        }
    }
}
