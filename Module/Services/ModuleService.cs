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

