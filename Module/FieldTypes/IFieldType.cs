using Module.Entities;

namespace Module.FieldTypes;

public interface IFieldType
{
    string Type { get; }

    object? Parse(object? value);

    List<string> Validate(ModuleField field, object? value);
}
