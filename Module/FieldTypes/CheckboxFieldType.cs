using Module.Entities;

namespace Module.FieldTypes;

public class CheckboxFieldType : IFieldType
{
    public string Type => "checkbox";

    public object? Parse(object? value)
    {
        if (value == null) return false;
        if (bool.TryParse(value.ToString(), out bool result))
        {
            return result;
        }
        return false;
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        var errors = new List<string>();

        if (value != null)
        {
            if (!bool.TryParse(value.ToString(), out _))
            {
                errors.Add($"{field.Label} must be a boolean value.");
            }
        }

        return errors;
    }
}
