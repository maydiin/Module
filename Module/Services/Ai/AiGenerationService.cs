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
    private const string GeminiApiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    public AiGenerationService(HttpClient httpClient, IConfiguration configuration, AppDbContext context, ITenantService tenantService)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<AiSystemConfigDto> GenerateConfigAsync(string userPrompt)
    {
        var apiKey = _configuration["Gemini:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new InvalidOperationException("Gemini API Key is not configured.");
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

        var currentConfigJson = JsonSerializer.Serialize(currentConfig, new JsonSerializerOptions { WriteIndented = true });

        var systemPrompt = $@"
You are an AI architect helper. Your goal is to convert a user's verbal description of a CRM or business system into a structured JSON configuration.
The output MUST be a valid JSON object matching the following structure exactly. Do not include markdown code blocks (```json ... ```), just return the raw JSON.

Structure:
{{
  ""Modules"": [
    {{
      ""Name"": ""ModuleName"",
      ""AuditCreate"": true,
      ""AuditUpdate"": true,
      ""AuditDelete"": true,
      ""Fields"": [
        {{
          ""Name"": ""fieldName"",
          ""Label"": ""Field Label"",
          ""Type"": ""text|number|date|datetime|checkbox|select|email|phone|textarea|file|image|currency|percentage|multiselect|richtext|json|relation|formula"",
          ""Required"": boolean,
          ""Options"": ""option1,option2"" (for select/multiselect) OR ""TargetModuleName"" (for relation),
          ""OrderNo"": integer
        }}
      ]
    }}
  ],
  ""Scripts"": [],
  ""ApiConfigs"": []
}}

Rules:
1. Identify the entities the user needs (e.g., 'Customers', 'Project', 'Task') and create a Module for each.
2. For each module, generate appropriate fields based on common business practices and the user's description.
3. Use the correct 'Type' from the list provided.
4. For 'relation' type fields, set 'Options' to the exact Name of the related Module.
5. 'Scripts' and 'ApiConfigs' can be empty arrays for now unless the user explicitly asks for automation or integrations.

CURRENT SYSTEM CONFIGURATION:
The user already has the following modules and fields configured:
{currentConfigJson}

IMPORTANT:
- If the user asks to ADD something, generate the JSON for the NEW or MODIFIED parts.
- If the user asks to MODIFY an existing module (e.g., add a field), include the Module definition with the NEW field added to the list. You do NOT need to list all existing fields unless they are being changed, but keeping them for context is fine.
- Be careful NOT to duplicates existing fields if they are already present, unless the user wants to change them.
- If the user's request implies connecting to an existing module (e.g. ""Add a project for a customer"" where 'Customer' exists), use a 'relation' field pointing to the existing 'Customer' module.
";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = systemPrompt },
                        new { text = $"User Request: {userPrompt}" }
                    }
                }
            }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync($"{GeminiApiUrl}?key={apiKey}", jsonContent);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // Try to list available models to help with debugging
                try 
                {
                    var listModelsResponse = await _httpClient.GetAsync($"https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}");
                    if (listModelsResponse.IsSuccessStatusCode)
                    {
                        var modelsJson = await listModelsResponse.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(modelsJson);
                        var models = doc.RootElement.GetProperty("models").EnumerateArray()
                            .Select(m => m.GetProperty("name").GetString())
                            .Where(n => n != null && n.Contains("gemini"))
                            .ToList();
                            
                        throw new HttpRequestException($"Gemini Model not found. Available models: {string.Join(", ", models)}. Original Error: {error}");
                    }
                }
                catch
                {
                    // Ignore failure in error handling
                }
            }
            
            throw new HttpRequestException($"Gemini API Error: {response.StatusCode} - {error}");
        }

        var responseString = await response.Content.ReadAsStringAsync();
        var responseJson = JsonDocument.Parse(responseString);
        
        // Extract the text from the response structure of Gemini API
        var generatedText = responseJson.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();
            
        if (string.IsNullOrEmpty(generatedText))
        {
             throw new InvalidOperationException("Gemini API returned empty text.");
        }

        // Clean up markdown code blocks if present (just in case the model ignores the prompt)
        if (generatedText.StartsWith("```json"))
        {
            generatedText = generatedText.Replace("```json", "").Replace("```", "").Trim();
        }
        else if (generatedText.StartsWith("```"))
        {
            generatedText = generatedText.Replace("```", "").Trim();
        }

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

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
}
