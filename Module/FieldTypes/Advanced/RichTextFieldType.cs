using System.Text.Json;
using System.Text.RegularExpressions;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class RichTextFieldType : IFieldType
{
    public string Type => "richtext";

    public object? Parse(object? value)
    {
        var raw = value?.ToString();
        if (string.IsNullOrEmpty(raw)) return raw;

        // Simple script tag sanitization
        return Regex.Replace(raw, "<script.*?>.*?</script>", string.Empty, RegexOptions.IgnoreCase | RegexOptions.Singleline);
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
            var stringValue = value.ToString()!;
            
            if (!string.IsNullOrEmpty(field.Options))
            {
                try
                {
                    using var doc = JsonDocument.Parse(field.Options);
                    if (doc.RootElement.TryGetProperty("maxLength", out var maxLengthElement) && maxLengthElement.TryGetInt32(out var maxLength))
                    {
                        if (stringValue.Length > maxLength)
                        {
                            errors.Add($"{field.Label} exceeds maximum length of {maxLength}.");
                        }
                    }
                }
                catch { }
            }
        }

        return errors;
    }
}
