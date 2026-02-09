using Module.Entities;

namespace Module.FieldTypes;

public interface IFieldType
{
    string Type { get; }

    object? Parse(object? value);

    List<string> Validate(ModuleField field, object? value);

    object? Compute(ModuleField field, object? recordData) => null;
    string Format(object? value) => value?.ToString() ?? string.Empty;
    object? Index(object? value) => value;
}
