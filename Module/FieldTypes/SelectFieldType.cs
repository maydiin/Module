using System.Text.Json;
using Module.Entities;

namespace Module.FieldTypes;

public class SelectFieldType : IFieldType
{
    public string Type => "select";

    public object? Parse(object? value)
    {
        return value?.ToString();
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        var errors = new List<string>();

        if (field.Required && (value == null || string.IsNullOrWhiteSpace(value.ToString())))
        {
            errors.Add($"{field.Label} is required.");
            return errors;
        }

        if (value != null && !string.IsNullOrWhiteSpace(field.Options))
        {
            try
            {
                var options = JsonSerializer.Deserialize<List<string>>(field.Options);
                if (options != null && !options.Contains(value.ToString()!))
                {
                    errors.Add($"{field.Label} has an invalid value.");
                }
            }
            catch (JsonException)
            {
                // If options are not properly formatted, we might want to log this
                // but for now we just skip validation against options
            }
        }

        return errors;
    }
}
