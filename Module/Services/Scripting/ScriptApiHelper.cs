using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;
using Module.Services;
using Module.Common;

namespace Module.Services.Scripting;

public class ScriptApiHelper : IScriptApiHelper
{
    private readonly AppDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IExternalApiService _apiService;
    private readonly ITenantService _tenantService;

    public ScriptApiHelper(
        AppDbContext context, 
        IHttpClientFactory httpClientFactory, 
        IExternalApiService apiService,
        ITenantService tenantService)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _apiService = apiService;
        _tenantService = tenantService;
    }

    public async Task<object> ExecuteAsync(int moduleId, string configName, Dictionary<string, object> parameters)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var config = await _context.ExternalApiConfigs
            .FirstOrDefaultAsync(c => c.ModuleId == moduleId && c.Name == configName && c.TenantId == tenantId);

        if (config == null)
        {
            return new { Success = false, Error = $"API Configuration '{configName}' not found." };
        }

        try
        {
            var client = _httpClientFactory.CreateClient();

            // Add custom headers
            if (!string.IsNullOrEmpty(config.HeadersJson))
            {
                var headers = JsonSerializer.Deserialize<Dictionary<string, string>>(config.HeadersJson);
                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        client.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }
            }

            // Convert parameters to dictionary<string, string> for template replacement if possible
            var stringParams = parameters.ToDictionary(k => k.Key, k => k.Value?.ToString() ?? "");

            HttpResponseMessage response;
            string url = _apiService.PrepareTemplate(config.Url, "{}", stringParams);

            if (config.Method == "POST" || config.Method == "PUT")
            {
                string body = _apiService.PrepareTemplate(config.RequestBodyTemplate ?? "{}", "{}", stringParams);
                var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
                
                if (config.Method == "PUT")
                     response = await client.PutAsync(url, content);
                else 
                     response = await client.PostAsync(url, content);
            }
            else if (config.Method == "DELETE")
            {
                 response = await client.DeleteAsync(url);
            }
            else
            {
                response = await client.GetAsync(url);
            }

            if (!response.IsSuccessStatusCode)
            {
                return new { Success = false, Error = $"API returned error: {response.StatusCode}" };
            }

            var apiResponseJson = await response.Content.ReadAsStringAsync();
            
            // If the response is an array, we map it as a list of records
            // If it's a single object, we map it as a single record
            // However, MapResponseToRecordData is designed for single object -> single record data
            // And MapArrayResponse is for array -> list of record data
            
            // We need a generic way to return data to script.
            // The existing methods in ExternalApiService are tied to "Module Record Fields".
            // If the user wants raw data, maybe we should just return that?
            // But the requirement implies using the config which has "Response Mapping".
            
            // Let's try to map using the config if mappings exist.
            if (!string.IsNullOrEmpty(config.ResponseMappingsJson) && config.ResponseMappingsJson != "{}")
            {
                // Try array first logic? Or check response structure?
                // The ExternalApiService.MapArrayResponse handles checking if it's array or object.
                var (mappedRecords, mappingErrors) = _apiService.MapArrayResponse(apiResponseJson, config.ResponseMappingsJson, stringParams);
                
                if (mappingErrors.Any())
                {
                     return new { Success = false, Error = "Mapping errors: " + string.Join("; ", mappingErrors) };
                }

                // Parse the mapped record JSONs back to objects so Jint can use them
                var resultObjects = mappedRecords.Select(json => {
                    var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                    dict?.Normalize();
                    return dict;
                }).ToList();
                
                return new { Success = true, Data = resultObjects };
            }
            else
            {
                // Return raw string or try to parse as JSON object
                try 
                {
                    var resultObject = JsonSerializer.Deserialize<Dictionary<string, object>>(apiResponseJson);
                    resultObject?.Normalize();
                    return new { Success = true, Data = resultObject };
                }
                catch
                {
                    // Fallback for non-JSON response or arrays
                     try 
                     {
                        var resultArray = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(apiResponseJson);
                        if (resultArray != null) {
                            foreach(var item in resultArray) item.Normalize();
                        }
                        return new { Success = true, Data = resultArray };
                     }
                     catch
                     {
                         return new { Success = true, Data = apiResponseJson };
                     }
                }
            }
        }
        catch (Exception ex)
        {
            return new { Success = false, Error = $"Internal error: {ex.Message}" };
        }
    }
}
