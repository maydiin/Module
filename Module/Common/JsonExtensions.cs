using System.Text.Json;
using System.Collections.Generic;
using System.Linq;

namespace Module.Common;

public static class JsonExtensions
{
    public static object? ToPrimitive(this JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                return element.GetString();
            case JsonValueKind.Number:
                if (element.TryGetInt64(out long l)) return l;
                return element.GetDouble();
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            case JsonValueKind.Null:
                return null;
            case JsonValueKind.Object:
                return element.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.ToPrimitive())!;
            case JsonValueKind.Array:
                return element.EnumerateArray().Select(e => e.ToPrimitive()).ToList();
            default:
                return null;
        }
    }

    public static void Normalize(this Dictionary<string, object> dictionary)
    {
        var keys = dictionary.Keys.ToList();
        foreach (var key in keys)
        {
            var value = dictionary[key];
            if (value is JsonElement element)
            {
                dictionary[key] = element.ToPrimitive()!;
            }
            else if (value is Dictionary<string, object> subDict)
            {
                subDict.Normalize();
            }
            else if (value is System.Collections.IList list)
            {
                for (int i = 0; i < list.Count; i++)
                {
                    if (list[i] is JsonElement el)
                    {
                        try { list[i] = el.ToPrimitive(); } catch { }
                    }
                    else if (list[i] is Dictionary<string, object> d)
                    {
                        d.Normalize();
                    }
                }
            }
        }
    }
}
