using System.Globalization;
using Module.Entities;

namespace Module.FieldTypes;

public class DateFieldType : IFieldType
{
    public string Type => "date";

    public object? Parse(object? value)
    {
        if (value == null) return null;
        if (DateTime.TryParse(value.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime result))
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
            if (!DateTime.TryParse(value.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            {
                errors.Add($"{field.Label} must be a valid date.");
            }
        }

        return errors;
    }
}
