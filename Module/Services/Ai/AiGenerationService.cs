using System.Text.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs.Ai;

namespace Module.Services.Ai;

public class AiGenerationService : IAiGenerationService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private const string DefaultGeminiApiUrl = "https://generativelanguage.googleapis.com/v1beta/models/";

    public AiGenerationService(HttpClient httpClient, IConfiguration configuration, AppDbContext context, ITenantService tenantService)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<AiSystemConfigDto> GenerateConfigAsync(string userPrompt)
    {
        var apiKey = _configuration["Ai:ApiKey"] ?? _configuration["Gemini:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new InvalidOperationException("AI API Key is not configured.");
        }

        // 1. Fetch current system configuration
        var tenantId = _tenantService.GetCurrentTenantId();
        var existingModules = await _context.Modules
            .Where(m => m.TenantId == tenantId)
            .Include(m => m.Fields)
            .ToListAsync();

        var currentConfig = new
        {
            Modules = existingModules.Select(m => new
            {
                m.Name,
                Fields = m.Fields.Select(f => new
                {
                    f.Name,
                    f.Label,
                    f.Type,
                    f.Options
                })
            })
        };

        var currentConfigJson =
            JsonSerializer.Serialize(currentConfig, new JsonSerializerOptions { WriteIndented = true });

        var systemPrompt = $$$$"""
                               You are an AI architect helper. Your goal is to convert a user's verbal description of a CRM or business system into a structured JSON configuration.
                               The output MUST be a valid JSON object matching the following structure exactly. Do not include markdown code blocks (```json ... ```), just return the raw JSON.

                               Structure:
                               {
                                 "Modules": [
                                   {
                                     "Name": "ModuleName",
                                     "AuditCreate": true,
                                     "AuditUpdate": true,
                                     "AuditDelete": true,
                                     "Fields": [
                                       {
                                         "Name": "fieldName",
                                         "Label": "Field Label",
                                         "Type": "text|number|date|datetime|checkbox|select|email|phone|textarea|file|image|currency|percentage|multiselect|richtext|json|relation|formula",
                                         "Required": boolean,
                                         "Options": "option1,option2" (for select/multiselect) OR "TargetModuleName" (for relation) OR "{{field1}} * {{field2}}" (for formula),
                                         "OrderNo": integer,
                                         "IsDisplayField": boolean // true if this field should be used to display or identify the record (e.g., Name, Title, Reference Number)
                                       }
                                     ]
                                   }
                                 ],
                                 "Scripts": [
                                   {
                                     "ModuleName": "ModuleName",
                                     "TriggerType": "BeforeCreate|AfterCreate|BeforeUpdate|AfterUpdate|BeforeDelete|AfterDelete|CustomList",
                                     "ScriptContent": "// JS code. Available: Db, Data, User, Fail(msg), Log(msg)",
                                     "IsActive": true
                                   }
                                 ],
                                 "ApiConfigs": [
                                   {
                                     "ModuleName": "ModuleName",
                                     "Name": "Config Name",
                                     "Url": "https://api.com/v1/{{Field}}",
                                     "Method": "GET|POST|PUT|DELETE",
                                     "HeadersJson": "{\"Auth\": \"Bearer ...\"}",
                                     "RequestBodyTemplate": "{\"id\": {{Id}}}",
                                     "ResponseMappingsJson": "{\"result.path\": \"FieldName\"}"
                                   }
                                 ],
                                 "Reports": [
                                   {
                                     "ModuleName": "ModuleName",
                                     "Name": "Report Name",
                                     "Type": "List|Chart|Pivot",
                                     "Configuration": "{\"columns\": [\"Field1\", \"Field2\"]} for List, OR {\"groupBy\": \"FieldName\"} for Chart" (JSON string),
                                     "IsActive": true
                                   }
                                 ]
                               }

                               Rules:
                               1. Identify the entities the user needs (e.g., 'Customers', 'Project', 'Task') and create a Module for each.
                               2. For each module, generate appropriate fields based on common business practices and the user's description.
                               3. Use the correct 'Type' from the list provided.
                               4. For 'relation' type fields, set 'Options' to the exact Name of the related Module.
                               5. For 'formula' type fields, set 'Options' to a calculation expression using field names in curly braces. 
                                  Supported syntax: "{{field1}} operator {{field2}}". 
                                  Operators: +, -, *, /. 
                                  Example: "{{UnitPrice}} * {{Quantity}}" or "{{TotalAmount}} - {{Discount}}".
                               6. 'Scripts' should be used for validation or automation logic. Use 'BeforeCreate/Update' for validation (call Fail(msg) to abort). Use 'AfterCreate/Update' for side effects.
                               7. 'ApiConfigs' should be used for external integrations. Use {{FieldName}} syntax in Url, HeadersJson, and RequestBodyTemplate for dynamic values.
                               8. 'Reports' can be used to create custom views or charts for a module.
                                  - If Type is 'List', Configuration must contain a 'columns' array with field names.
                                  - If Type is 'Chart', Configuration must contain a 'groupBy' field with the name of the field to aggregate by.
                                  - Generate appropriate entries if the user asks for dashboards, reporting, or specific analysis.
                               9. For 'ApiConfigs', 'ResponseMappingsJson' is a dictionary where key is the JS path in the JSON response (e.g. 'result.id') and value is the Module field name to update.

                               CURRENT SYSTEM CONFIGURATION:
                               The user already has the following modules and fields configured:
                               {{{{currentConfigJson}}}}

                               IMPORTANT:
                               - If the user asks to ADD something, generate the JSON for the NEW or MODIFIED parts.
                               - If the user asks to MODIFY an existing module (e.g., add a field), include the Module definition with the NEW field added to the list. You do NOT need to list all existing fields unless they are being changed, but keeping them for context is fine.
                               - Be careful NOT to duplicates existing fields if they are already present, unless the user wants to change them.
                               - If the user's request implies connecting to an existing module (e.g. "Add a project for a customer" where 'Customer' exists), use a 'relation' field pointing to the existing 'Customer' module.
                               """;

        var generatedText = await CallAiAsync(apiKey, systemPrompt, $"User Request: {userPrompt}");

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try
        {
            return JsonSerializer.Deserialize<AiSystemConfigDto>(generatedText, options)
                   ?? new AiSystemConfigDto();
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Failed to parse AI response as JSON. Response: {generatedText}", ex);
        }
    }
    

    public async Task<AiSystemConfigDto> GenerateReportConfigAsync(int moduleId, string userPrompt)
    {
        var apiKey = _configuration["Ai:ApiKey"] ?? _configuration["Gemini:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new InvalidOperationException("AI API Key is not configured.");
        }

        var tenantId = _tenantService.GetCurrentTenantId();
        var module = await _context.Modules
            .Include(m => m.Fields)
            .FirstOrDefaultAsync(m => m.Id == moduleId && m.TenantId == tenantId);

        if (module == null)
        {
            throw new KeyNotFoundException($"Module with ID {moduleId} not found.");
        }

        var existingReports = await _context.ModuleReports
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId)
            .ToListAsync();

        var currentConfig = new
        {
            Module = new
            {
                module.Name,
                Fields = module.Fields.Select(f => new
                {
                    f.Name,
                    f.Label,
                    f.Type,
                    f.Options
                })
            },
            ExistingReports = existingReports.Select(r => new
            {
                r.Name,
                r.Type,
                r.Configuration
            })
        };

        var currentConfigJson = JsonSerializer.Serialize(currentConfig, new JsonSerializerOptions { WriteIndented = true });

        var systemPrompt = $$$$"""
You are an AI reporting specialist. Your goal is to generate report configurations for a specific module in a business system.
The output MUST be a valid JSON object matching the following structure exactly. Do not include markdown code blocks (```json ... ```), just return the raw JSON.

Structure:
{
  "Reports": [
    {
      "ModuleName": "{{{{module.Name}}}}",
      "Name": "Report Name",
      "Type": "List|Pivot|Chart:Bar|Chart:Line|Chart:Pie|Chart:Funnel|Chart:Gauge|Chart:Heatmap|Chart:Bubble",
      "Configuration": "JSON string containing configuration",
      "IsActive": true
    }
  ]
}

Configuration JSON Schemas:
1. For Type 'List':
   {
     "columns": ["field1", "field2"],
     "filters": [{"field": "status", "operator": "eq", "value": "active"}],
     "sortBy": "createdAt",
     "sortOrder": "desc",
     "limit": 100
   }

2. For Type 'Chart:*':
   {
     "chartType": "bar|line|pie|funnel|gauge|heatmap|bubble",
     "groupBy": "fieldName",
     "aggregateField": "fieldName",
     "aggregateType": "count|sum|avg|min|max",
     "xAxisField": "fieldName",
     "yAxisField": "fieldName",
     "zAxisField": "fieldName", (for bubble)
     "filters": []
   }

3. For Type 'Pivot':
   {
     "rows": ["field1"],
     "columns": ["field2"],
     "values": [{"field": "amount", "type": "sum"}],
     "filters": []
   }

Rules:
1. Use the fields available in the provided module.
2. If Type is 'Chart', prefix it with 'Chart:' but also set 'chartType' inside the configuration JSON correctly.
3. Generate appropriate reports based on the user's description.
4. Try to avoid duplicating existing reports unless asked to modify them.

MODULE STRUCTURE:
{{{{currentConfigJson}}}}

IMPORTANT:
- Return ONLY the JSON for the NEW or MODIFIED report.
- If the user's request is vague, guess likely useful reports for this type of module.
""";

        var generatedText = await CallAiAsync(apiKey, systemPrompt, $"User Request: {userPrompt}");

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        return JsonSerializer.Deserialize<AiSystemConfigDto>(generatedText, options) ?? new AiSystemConfigDto();
    }

    /// <summary>
    /// Routes the request to the configured AI provider.
    /// </summary>
    private async Task<string> CallAiAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var provider = _configuration["Ai:Provider"]?.ToLowerInvariant() ?? "gemini";
        
        if (provider == "openai")
        {
            return await CallOpenAiAsync(apiKey, systemPrompt, userMessage);
        }
        else
        {
            return await CallGeminiAsync(apiKey, systemPrompt, userMessage);
        }
    }

    /// <summary>
    /// Sends a prompt to an OpenAI-compatible API and returns the cleaned, raw text response.
    /// </summary>
    private async Task<string> CallOpenAiAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var baseUrl = _configuration["Ai:BaseUrl"];
        if (string.IsNullOrEmpty(baseUrl))
        {
            throw new InvalidOperationException("AI BaseUrl is not configured for OpenAI provider.");
        }

        var model = _configuration["Ai:Model"] ?? "gpt-3.5-turbo"; // Default to a standard model name if not provided
        var apiUrl = baseUrl.TrimEnd('/') + "/chat/completions";

        var requestBody = new
        {
            model = model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage }
            }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        
        // Use a HttpRequestMessage object to add Headers safely
        using var requestMessage = new HttpRequestMessage(HttpMethod.Post, apiUrl)
        {
            Content = jsonContent
        };
        requestMessage.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        var response = await _httpClient.SendAsync(requestMessage);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"OpenAI-Compatible API Error: {response.StatusCode} - {error}");
        }

        var responseString = await response.Content.ReadAsStringAsync();
        using var responseJson = JsonDocument.Parse(responseString);

        var generatedText = responseJson.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        return CleanResponseText(generatedText);
    }

    /// <summary>
    /// Sends a prompt to the Gemini API and returns the cleaned, raw text response.
    /// Handles HTTP errors, model-not-found diagnostics, and markdown code-block stripping.
    /// </summary>
    private async Task<string> CallGeminiAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = systemPrompt + "\n\n" + userMessage }
                    }
                }
            }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        
        var baseUrl = _configuration["Ai:BaseUrl"] ?? DefaultGeminiApiUrl;
        var model = _configuration["Ai:Model"] ?? "gemini-2.0-flash";
        
        // Ensure BaseUrl ends with / and construct full URL format expected by Gemini
        var apiUrl = $"{baseUrl.TrimEnd('/')}/{model}:generateContent?key={apiKey}";
        
        var response = await _httpClient.PostAsync(apiUrl, jsonContent);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                try
                {
                    var listModelsResponse = await _httpClient.GetAsync(
                        $"https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}");
                    if (listModelsResponse.IsSuccessStatusCode)
                    {
                        var modelsJson = await listModelsResponse.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(modelsJson);
                        var models = doc.RootElement.GetProperty("models").EnumerateArray()
                            .Select(m => m.GetProperty("name").GetString())
                            .Where(n => n != null && n.Contains("gemini"))
                            .ToList();

                        throw new HttpRequestException(
                            $"Gemini Model not found. Available models: {string.Join(", ", models)}. Original Error: {error}");
                    }
                }
                catch (HttpRequestException)
                {
                    throw;
                }
                catch
                {
                    // Ignore failure in error diagnostic fallback
                }
            }

            throw new HttpRequestException($"Gemini API Error: {response.StatusCode} - {error}");
        }

        var responseString = await response.Content.ReadAsStringAsync();
        using var responseJson = JsonDocument.Parse(responseString);

        var generatedText = responseJson.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        return CleanResponseText(generatedText);
    }
    
    private string CleanResponseText(string? generatedText)
    {
        if (string.IsNullOrEmpty(generatedText))
            throw new InvalidOperationException("API returned empty text.");

        // Strip markdown code blocks the model may wrap output in despite instructions
        if (generatedText.StartsWith("```json"))
            generatedText = generatedText.Replace("```json", "").Replace("```", "").Trim();
        else if (generatedText.StartsWith("```"))
            generatedText = generatedText.Replace("```", "").Trim();

        return generatedText;
    }
}
