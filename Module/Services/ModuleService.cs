using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;

using Module.FieldTypes;

namespace Module.Services;

public class ModuleService : IModuleService
{
    private readonly AppDbContext _context;
    private readonly FieldTypeFactory _fieldTypeFactory;
    private readonly JsonSerializerOptions _jsonOptions;

    public ModuleService(AppDbContext context, FieldTypeFactory fieldTypeFactory)
    {
        _context = context;
        _fieldTypeFactory = fieldTypeFactory;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };
    }

    public async Task<List<string>> ValidateDataAsync(int moduleId, Dictionary<string, object> data)
    {
        var fields = await _context.ModuleFields
            .Where(f => f.ModuleId == moduleId)
            .ToListAsync();

        var allErrors = new List<string>();

        foreach (var field in fields)
        {
            var fieldType = _fieldTypeFactory.Get(field.Type);
            data.TryGetValue(field.Name, out var value);
            
            var errors = fieldType.Validate(field, value);
            allErrors.AddRange(errors);
        }

        return allErrors;
    }

    public Dictionary<string, object> ComputeFormulas(Entities.Module module, Dictionary<string, object> data)
    {
        // Compute non-stored formula fields at runtime
        foreach (var field in module.Fields.Where(f => !f.IsStored && f.Type == "formula").OrderBy(f => f.OrderNo))
        {
            try
            {
                var fieldType = _fieldTypeFactory.Get(field.Type);
                var computedValue = fieldType.Compute(field, data);
                if (computedValue != null)
                {
                    data[field.Name] = computedValue;
                }
            }
            catch (Exception) { /* ignore */ }
        }
        
        // Add __displayValue
        var displayFields = module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
        if (displayFields.Any())
        {
            var vals = new List<string>();
            foreach (var df in displayFields)
            {
                if (data.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                    vals.Add(dfVal.ToString()!);
            }
            if (vals.Any()) data["__displayValue"] = string.Join(" - ", vals);
        }
        else
        {
            var fallbackField = module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
            if (fallbackField != null && data.TryGetValue(fallbackField.Name, out var val) && val != null)
                data["__displayValue"] = val.ToString();
            else if (data.TryGetValue("id", out var idVal))
                data["__displayValue"] = idVal?.ToString() ?? "0";
        }

        return data;
    }

    public string SerializeData(Dictionary<string, object> data)
    {
        return JsonSerializer.Serialize(data, _jsonOptions);
    }

    public Dictionary<string, object> DeserializeData(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new Dictionary<string, object>();
        }

        var result = JsonSerializer.Deserialize<Dictionary<string, object>>(json, _jsonOptions);
        return result ?? new Dictionary<string, object>();
    }
}

