using System.Text.Json;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class JsonFieldType : IFieldType
{
    public string Type => "json";

    public object? Parse(object? value)
    {
        if (value == null) return null;
        var stringValue = value.ToString();
        if (string.IsNullOrWhiteSpace(stringValue)) return null;

        try
        {
            return JsonSerializer.Deserialize<object>(stringValue);
        }
        catch
        {
            return value;
        }
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        var errors = new List<string>();

        if (field.Required && (value == null || string.IsNullOrWhiteSpace(value.ToString())))
        {
            errors.Add($"{field.Label} is required.");
            return errors;
        }

        if (value != null && !string.IsNullOrWhiteSpace(value.ToString()))
        {
            try
            {
                JsonDocument.Parse(value.ToString()!);
            }
            catch (JsonException)
            {
                errors.Add($"{field.Label} must be a valid JSON string.");
            }
        }

        return errors;
    }
}
