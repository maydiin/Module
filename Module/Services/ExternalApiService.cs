using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Module.Entities;

namespace Module.Services;

public class ExternalApiService : IExternalApiService
{
    public string PrepareTemplate(string template, string recordDataJson, IDictionary<string, string>? parameters = null)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;

        var recordData = new Dictionary<string, string>();
        if (!string.IsNullOrEmpty(recordDataJson))
        {
            var deserialized = JsonSerializer.Deserialize<Dictionary<string, object>>(recordDataJson);
            if (deserialized != null)
            {
                foreach (var kvp in deserialized)
                {
                    recordData[kvp.Key] = kvp.Value?.ToString() ?? string.Empty;
                }
            }
        }

        // Merge parameters (parameters take precedence or just complement)
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                recordData[param.Key] = param.Value;
            }
        }

        // Regex to find {{FieldName}}
        var regex = new Regex(@"\{\{(.*?)\}\}");
        return regex.Replace(template, match =>
        {
            var fieldName = match.Groups[1].Value.Trim();
            if (recordData.TryGetValue(fieldName, out var value))
            {
                return value;
            }
            return match.Value; // Keep as is if not found
        });
    }

    public string MapResponseToRecordData(string apiResponseJson, string responseMappingsJson, string currentRecordDataJson)
    {
        if (string.IsNullOrEmpty(apiResponseJson) || string.IsNullOrEmpty(responseMappingsJson))
            return currentRecordDataJson;

        try
        {
            var apiResponse = JsonNode.Parse(apiResponseJson);
            var mappings = JsonSerializer.Deserialize<Dictionary<string, string>>(responseMappingsJson);
            
            if (apiResponse == null || mappings == null) return currentRecordDataJson;

            return MapJsonToRecordData(apiResponse, mappings, currentRecordDataJson);
        }
        catch
        {
            return currentRecordDataJson; // Fallback to original on error
        }
    }

    public List<string> MapArrayResponse(string apiResponseJson, string responseMappingsJson, IDictionary<string, string>? parameters = null)
    {
        var result = new List<string>();
        if (string.IsNullOrEmpty(apiResponseJson) || string.IsNullOrEmpty(responseMappingsJson))
            return result;

        try
        {
            var apiResponse = JsonNode.Parse(apiResponseJson);
            var mappings = JsonSerializer.Deserialize<Dictionary<string, string>>(responseMappingsJson);

            if (apiResponse == null || mappings == null) return result;

            // Handle root path if specified
            JsonNode? arrayNode = apiResponse;
            if (mappings.TryGetValue("__root__", out var rootPath))
            {
                arrayNode = GetNodeByPath(apiResponse, rootPath);
            }

            if (arrayNode is JsonArray jsonArray)
            {
                foreach (var item in jsonArray)
                {
                    if (item != null)
                    {
                        var recordDataJson = MapJsonToRecordData(item, mappings, "{}", parameters);
                        result.Add(recordDataJson);
                    }
                }
            }
            else if (arrayNode is JsonObject)
            {
                 // Single object fallback
                 result.Add(MapJsonToRecordData(arrayNode, mappings, "{}", parameters));
            }
        }
        catch { }

        return result;
    }

    private string MapJsonToRecordData(JsonNode node, Dictionary<string, string> mappings, string currentRecordDataJson, IDictionary<string, string>? parameters = null)
    {
        var recordDataNode = JsonNode.Parse(currentRecordDataJson)?.AsObject() ?? new JsonObject();

        foreach (var mapping in mappings)
        {
            var apiPath = mapping.Key;
            if (apiPath == "__root__") continue; // Skip special key

            var moduleFieldName = mapping.Value;

            var value = GetValueByPath(node, apiPath);
            if (value != null)
            {
                recordDataNode[moduleFieldName] = JsonValue.Create(value);
            }
        }

        // Include all parameters in the record data as well.
        // This allows parameters (like sube, person_id) to be used for relations 
        // even if they are not explicitly in the API response mappings.
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                if (!recordDataNode.ContainsKey(param.Key))
                {
                    recordDataNode[param.Key] = JsonValue.Create(param.Value);
                }
            }
        }

        return recordDataNode.ToJsonString();
    }

    private JsonNode? GetNodeByPath(JsonNode? node, string path)
    {
        if (node == null || string.IsNullOrEmpty(path)) return node;

        var parts = path.Split('.');
        JsonNode? current = node;

        foreach (var part in parts)
        {
            if (current == null) return null;
            current = current[part];
        }

        return current;
    }

    private object? GetValueByPath(JsonNode? node, string path)
    {
        var current = GetNodeByPath(node, path);
        if (current == null) return null;

        if (current is JsonValue jsonValue)
        {
            if (jsonValue.TryGetValue<string>(out var s)) return s;
            if (jsonValue.TryGetValue<decimal>(out var d)) return d;
            if (jsonValue.TryGetValue<int>(out var i)) return i;
            if (jsonValue.TryGetValue<bool>(out var b)) return b;
            return jsonValue.ToString();
        }

        return current.ToString();
    }
}
