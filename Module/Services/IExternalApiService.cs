using Module.Entities;

namespace Module.Services;

public interface IExternalApiService
{
    /// <summary>
    /// Replaces placeholders in a template string with values from the record data or provided parameters.
    /// Placeholders are in the format {{FieldName}}.
    /// </summary>
    string PrepareTemplate(string template, string recordDataJson, IDictionary<string, string>? parameters = null);

    /// <summary>
    /// Maps data from an API response JSON (that is an array) to a list of module record data JSON strings.
    /// Parameters can be used to fill missing fields in the response.
    /// </summary>
    List<string> MapArrayResponse(string apiResponseJson, string responseMappingsJson, IDictionary<string, string>? parameters = null);
}
