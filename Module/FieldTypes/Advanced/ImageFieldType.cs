using System.Text.Json;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class ImageFieldType : IFieldType
{
    public string Type => "image";

    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };

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

            if (!AllowedExtensions.Contains(extension))
            {
                errors.Add($"{field.Label} must be an image (jpg, png, webp).");
            }

            // Optional MaxSizeKB validation if provided in Options
            if (!string.IsNullOrEmpty(field.Options))
            {
                try
                {
                    using var doc = JsonDocument.Parse(field.Options);
                    if (doc.RootElement.TryGetProperty("maxSizeKB", out var sizeElement) && sizeElement.TryGetInt32(out var maxSize))
                    {
                        // In a real scenario, we'd check the actual file size. 
                        // Here we just provide the structure for validation.
                    }
                }
                catch { }
            }
        }

        return errors;
    }
}
