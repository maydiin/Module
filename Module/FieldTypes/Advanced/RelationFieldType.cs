using Module.Data;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class RelationFieldType : IFieldType
{
    private readonly IRepository _repository;

    public string Type => "relation";

    public RelationFieldType(IRepository repository)
    {
        _repository = repository;
    }

    public object? Parse(object? value)
    {
        if (value == null) return null;
        
        if (value is System.Text.Json.JsonElement element && element.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<int>>(element.GetRawText());
            }
            catch { }
        }

        if (int.TryParse(value.ToString(), out var id)) return id;
        return value;
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        var errors = new List<string>();

        if (field.Required && value == null)
        {
            errors.Add($"{field.Label} is required.");
            return errors;
        }

        if (value != null)
        {
            var ids = new List<int>();
            if (value is List<int> list)
            {
                ids = list;
            }
            else if (value is List<long> longList)
            {
                ids = longList.Select(l => (int)l).ToList();
            }
            else if (int.TryParse(value.ToString(), out var id))
            {
                ids.Add(id);
            }
            else
            {
                // Try to parse if it's a JSON array or string
                var parsed = Parse(value);
                if (parsed is List<int> pList) ids = pList;
                else if (parsed is int pId) ids.Add(pId);
            }

            if (ids.Count == 0 && value != null)
            {
                errors.Add($"{field.Label} must be a valid ID or list of IDs.");
            }
            else if (!string.IsNullOrEmpty(field.Options))
            {
                // Options contains target module name
                var targetModule = field.Options.Trim('\"');
                
                foreach (var id in ids)
                {
                    // We run validation synchronously in IFieldType interface, 
                    // so we use .GetAwaiter().GetResult() for the async check.
                    var exists = _repository.ExistsAsync(targetModule, id).GetAwaiter().GetResult();
                    if (!exists)
                    {
                        errors.Add($"Selected {field.Label} record (ID: {id}) does not exist in module '{targetModule}'.");
                    }
                }
            }
        }

        return errors;
    }
}
