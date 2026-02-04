using System.Globalization;
using Module.Entities;

namespace Module.FieldTypes;

public class NumberFieldType : IFieldType
{
    public string Type => "number";

    public object? Parse(object? value)
    {
        if (value == null) return null;
        if (double.TryParse(value.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out double result))
        {
            return result;
        }
        return null;
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        var errors = new List<string>();

        if (field.Required && value == null)
        {
            errors.Add($"{field.Label} is required.");
            return errors;
        }

        if (value != null)
        {
            if (!double.TryParse(value.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out _))
            {
                errors.Add($"{field.Label} must be a valid number.");
            }
        }

        return errors;
    }
}
