using System.Text.RegularExpressions;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class PhoneFieldType : IFieldType
{
    public string Type => "phone";

    private static readonly Regex PhoneRegex = new Regex(
        @"^[0-9+\-() ]+$",
        RegexOptions.Compiled);

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
            
            if (!PhoneRegex.IsMatch(stringValue))
            {
                errors.Add($"{field.Label} contains invalid characters. Only digits, +, -, and parentheses are allowed.");
            }

            var digitCount = stringValue.Count(char.IsDigit);
            if (digitCount < 7 || digitCount > 15)
            {
                errors.Add($"{field.Label} must contain between 7 and 15 digits.");
            }
        }

        return errors;
    }
}
