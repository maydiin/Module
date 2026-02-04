using System.Text.Json;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class FileFieldType : IFieldType
{
    public string Type => "file";

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

        if (value != null && !string.IsNullOrWhiteSpace(value.ToString()))
        {
            var fileName = value.ToString()!;
            var extension = Path.GetExtension(fileName).ToLowerInvariant();

            if (!string.IsNullOrEmpty(field.Options))
            {
                try
                {
                    var allowedExtensions = JsonSerializer.Deserialize<List<string>>(field.Options);
                    if (allowedExtensions != null && allowedExtensions.Count > 0)
                    {
                        if (!allowedExtensions.Any(e => e.Equals(extension, StringComparison.OrdinalIgnoreCase)))
                        {
                            errors.Add($"{field.Label} has an invalid extension. Allowed: {string.Join(", ", allowedExtensions)}");
                        }
                    }
                }
                catch
                {
                    // If options is not a simple JSON array, it might be an object. 
                    // But requirement says field.Options contains extension list.
                }
            }
        }

        return errors;
    }
}
