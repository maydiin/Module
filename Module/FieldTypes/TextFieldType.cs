using Module.Entities;

namespace Module.FieldTypes;

public class TextFieldType : IFieldType
{
    public string Type => "text";

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
        }

        if (value != null && value is not string)
        {
            // If it's not a string, we check if ToString() helps, 
            // but usually incoming data from API for text is string.
        }

        return errors;
    }
}
