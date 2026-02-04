using System.Text.RegularExpressions;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class EmailFieldType : IFieldType
{
    public string Type => "email";

    private static readonly Regex EmailRegex = new Regex(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

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
            var stringValue = value.ToString()!;
            if (!EmailRegex.IsMatch(stringValue))
            {
                errors.Add($"{field.Label} is not a valid email address.");
            }
        }

        return errors;
    }
}
