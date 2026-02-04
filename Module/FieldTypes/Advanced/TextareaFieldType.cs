using System.Text.Json;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class TextareaFieldType : IFieldType
{
    public string Type => "textarea";

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

        if (value != null)
        {
            var stringValue = value.ToString() ?? string.Empty;
            
            // Handle MaxLength if defined in Options
            if (!string.IsNullOrEmpty(field.Options))
            {
                try 
                {
                    using var doc = JsonDocument.Parse(field.Options);
                    if (doc.RootElement.TryGetProperty("maxLength", out var maxLengthElement) && maxLengthElement.TryGetInt32(out var maxLength))
                    {
                        if (stringValue.Length > maxLength)
                        {
                            errors.Add($"{field.Label} cannot exceed {maxLength} characters.");
                        }
                    }
                }
                catch
                {
                    // Ignore invalid options JSON
                }
            }
        }

        return errors;
    }
}
