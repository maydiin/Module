using Module.Data;
using Module.Entities;

namespace Module.FieldTypes.Advanced;

public class RelationFieldType : IFieldType
{
    private readonly IRepository _repository;

    public string Type => "relation";

    public RelationFieldType(IRepository repository)
    {
        _repository = repository;
    }

    public object? Parse(object? value)
    {
        if (value == null) return null;
        if (int.TryParse(value.ToString(), out var id)) return id;
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
            if (!int.TryParse(value.ToString(), out var id))
            {
                errors.Add($"{field.Label} must be a valid ID (integer).");
            }
            else if (!string.IsNullOrEmpty(field.Options))
            {
                // Options contains target module name
                var targetModule = field.Options.Trim('\"');
                
                // We run validation synchronously in IFieldType interface, 
                // so we use .GetAwaiter().GetResult() for the async check.
                var exists = _repository.ExistsAsync(targetModule, id).GetAwaiter().GetResult();
                if (!exists)
                {
                    errors.Add($"Selected {field.Label} record (ID: {id}) does not exist in module '{targetModule}'.");
                }
            }
        }

        return errors;
    }
}
