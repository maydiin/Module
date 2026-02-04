using System.Text.Json;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class MultiSelectFieldType : IFieldType
{
    public string Type => "multiselect";

    public object? Parse(object? value)
    {
        if (value == null) return new List<string>();
        
        if (value is JsonElement element && element.ValueKind == JsonValueKind.Array)
        {
            return JsonSerializer.Deserialize<List<string>>(element.GetRawText());
        }

        if (value is string stringValue && !string.IsNullOrWhiteSpace(stringValue))
        {
            try { return JsonSerializer.Deserialize<List<string>>(stringValue); } catch { }
        }

        return value;
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        var errors = new List<string>();
        var selectedValues = new List<string>();

        if (value is List<string> list)
        {
            selectedValues = list;
        }
        else if (value != null)
        {
            // Try to parse if not already a list
            var parsed = Parse(value);
            if (parsed is List<string> pList) selectedValues = pList;
        }

        if (field.Required && (selectedValues == null || selectedValues.Count == 0))
        {
            errors.Add($"{field.Label} requires at least one selection.");
            return errors;
        }

        if (selectedValues != null && selectedValues.Count > 0 && !string.IsNullOrEmpty(field.Options))
        {
            try
            {
                var options = JsonSerializer.Deserialize<List<string>>(field.Options);
                if (options != null)
                {
                    foreach (var val in selectedValues)
                    {
                        if (!options.Contains(val))
                        {
                            errors.Add($"{val} is not a valid option for {field.Label}.");
                        }
                    }
                }
            }
            catch { }
        }

        return errors;
    }
}
