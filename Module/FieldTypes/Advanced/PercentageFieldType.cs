using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class PercentageFieldType : IFieldType
{
    public string Type => "percentage";

    public object? Parse(object? value)
    {
        if (value == null) return null;
        if (double.TryParse(value.ToString(), out var result))
        {
            return result;
        }
        return value;
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
            if (!double.TryParse(value.ToString(), out var result))
            {
                errors.Add($"{field.Label} must be a valid number.");
            }
            else if (result < 0 || result > 100)
            {
                errors.Add($"{field.Label} must be between 0 and 100.");
            }
        }

        return errors;
    }
}
