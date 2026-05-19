using System.Text.Json;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class RelationsFieldType : IFieldType
{
    public string Type => "relations";

    public object? Parse(object? value)
    {
        if (value == null) return null;
        
        if (value is System.Text.Json.JsonElement element)
        {
            if (element.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                try
                {
                    return System.Text.Json.JsonSerializer.Deserialize<List<Dictionary<string, object>>>(element.GetRawText());
                }
                catch { }
            }
        }
        return value;
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        var errors = new List<string>();

        if (field.Required)
        {
            if (value == null)
            {
                errors.Add($"{field.Label} is required.");
                return errors;
            }

            var list = Parse(value) as List<Dictionary<string, object>>;
            if (list == null || list.Count == 0)
            {
                errors.Add($"{field.Label} must contain at least one record.");
            }
        }

        return errors;
    }
}
