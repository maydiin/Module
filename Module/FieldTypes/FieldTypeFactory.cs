namespace Module.FieldTypes;

public class FieldTypeFactory
{
    private readonly IEnumerable<IFieldType> _types;

    public FieldTypeFactory(IEnumerable<IFieldType> types)
    {
        _types = types;
    }

    public IFieldType Get(string type)
    {
        var fieldType = _types.FirstOrDefault(t => t.Type == type);
        if (fieldType == null)
        {
            throw new ArgumentException($"Unsupported field type: {type}");
        }
        return fieldType;
    }

    public IEnumerable<string> GetSupportedTypes()
    {
        return _types.Select(t => t.Type);
    }
}
