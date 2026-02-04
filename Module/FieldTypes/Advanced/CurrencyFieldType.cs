using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class CurrencyFieldType : IFieldType
{
    public string Type => "currency";

    public object? Parse(object? value)
    {
        if (value == null) return null;
        if (decimal.TryParse(value.ToString(), out var result))
        {
            return Math.Round(result, 2);
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
            if (!decimal.TryParse(value.ToString(), out var result))
            {
                errors.Add($"{field.Label} must be a valid number.");
            }
            else if (result < 0)
            {
                errors.Add($"{field.Label} cannot be negative.");
            }
        }

        return errors;
    }
}
