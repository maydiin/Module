using System.Globalization;
using Module.Entities;

namespace Module.FieldTypes;

public class DateTimeFieldType : IFieldType
{
    public string Type => "datetime";

    public object? Parse(object? value)
    {
        if (value == null || string.IsNullOrWhiteSpace(value.ToString())) return null;
        
        if (DateTime.TryParse(value.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime result))
        {
            return result;
        }
        return null;
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
            if (!DateTime.TryParse(value.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            {
                errors.Add($"{field.Label} must be a valid date and time.");
            }
        }

        return errors;
    }
}
