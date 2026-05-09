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

    public async Task<AiGenerationResponseDto> GenerateConfigAsync(string userPrompt, List<AiChatMessageDto> history)
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
                m.KanbanField,
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

        var systemPrompt = $$$"""
                               You are an AI architect helper. Your goal is to convert a user's verbal description of a CRM or business system into a structured JSON configuration.
                               The output MUST be a valid JSON object matching the following structure exactly. Do not include markdown code blocks (```json ... ```), just return the raw JSON.

                               Structure:
                               {
                                 "NeedsMoreInfo": boolean,
                                 "Message": "If NeedsMoreInfo is true, ask your clarification question here (in the user's language). If false, provide a brief success message.",
                                 "Configuration": {
                                   "Modules": [
                                     {
                                       "Name": "ModuleName",
                                       "AuditCreate": true,
                                       "AuditUpdate": true,
                                       "AuditDelete": true,
                                       "KanbanField": "fieldName", // Optional. Set to a 'select' or 'checkbox' field name for default Kanban grouping.
                                       "Fields": [
                                         {
                                           "Name": "fieldName",
                                           "Label": "Field Label",
                                           "Type": "text|number|date|datetime|checkbox|select|email|phone|textarea|file|image|currency|percentage|multiselect|richtext|json|relation|formula",
                                           "Required": boolean,
                                           "Options": "[\"option1\",\"option2\"]" (for select/multiselect - MUST be a JSON array string in square brackets) OR "TargetModuleName" (for relation) OR "{{field1}} * {{field2}}" (for formula),
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
                                       "RequestBodyTemplate": "{\"id\": \"{Id}\"}",
                                       "ResponseMappingsJson": "{\"__root__\": \"data\", \"subead\": \"ŞubeAdı\", \"subeadres\": \"Adres\", \"subetel\": \"Telefon\", \"subemail\": \"Email\"}"
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
                                9. For 'ApiConfigs', 'ResponseMappingsJson' is a dictionary where key is the JS path in the JSON response (e.g. 'result.id' or '__root__' for data origin) and value is the Module field name to update.
                                   Example: {"__root__": "data", "subead": "ŞubeAdı", "subeadres": "Adres", "subetel": "Telefon", "subemail": "Email"}
                               10. Kanban View: If the user mentions Kanban, boards, or workflow, set 'KanbanField' in the Module configuration to an appropriate 'select' field name.
                               11. For 'select' or 'multiselect' fields, 'Options' MUST be a JSON array string in square brackets (e.g. "[\"A\", \"B\"]"). Do NOT use comma-separated strings.
                               12. IMPORTANT: Review the chat history carefully! If the user's intent is unclear or lacks details, set NeedsMoreInfo to true and ask questions in Message. If sufficient, set to false and provide Configuration. If NeedsMoreInfo is true, Configuration must be null or omitted.

                               CURRENT SYSTEM CONFIGURATION:
                               The user already has the following modules and fields configured:
                               {{{currentConfigJson}}}

                               IMPORTANT:
                               - If the user asks to ADD something, generate the JSON for the NEW or MODIFIED parts.
                               - If the user asks to MODIFY an existing module (e.g., add a field), include the Module definition with the NEW field added to the list. You do NOT need to list all existing fields unless they are being changed, but keeping them for context is fine.
                               - Be careful NOT to duplicates existing fields if they are already present, unless the user wants to change them.
                               - If the user's request implies connecting to an existing module (e.g. "Add a project for a customer" where 'Customer' exists), use a 'relation' field pointing to the existing 'Customer' module.
""";

        var chatHistory = new StringBuilder();
        if (history != null && history.Any())
        {
            chatHistory.AppendLine("CHAT HISTORY:");
            foreach (var msg in history)
            {
                chatHistory.AppendLine($"{msg.Role.ToUpper()}: {msg.Content}");
            }
            chatHistory.AppendLine();
        }

        var generatedText = await CallAiAsync(apiKey, systemPrompt, $"{chatHistory}User Request: {userPrompt}");

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try
        {
            return JsonSerializer.Deserialize<AiGenerationResponseDto>(generatedText, options)
                   ?? new AiGenerationResponseDto { NeedsMoreInfo = true, Message = "Failed to deserialize response." };
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Failed to parse AI response as JSON. Response: {generatedText}", ex);
        }
    }
    
    public async Task<AiGenerationResponseDto> GenerateReportConfigAsync(int moduleId, string userPrompt, List<AiChatMessageDto> history)
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
                module.KanbanField,
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
  "NeedsMoreInfo": false,
  "Message": "If NeedsMoreInfo is true, ask your clarification question here (in the user's language). If false, provide a brief success message.",
  "Configuration": {
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
5. IMPORTANT: Review the chat history carefully! If the user's intent is unclear or lacks details, set NeedsMoreInfo to true and ask questions in Message. If sufficient, set to false and provide Configuration. If NeedsMoreInfo is true, Configuration must be null or omitted.

MODULE STRUCTURE:
{{{{currentConfigJson}}}}

IMPORTANT:
- Return ONLY the JSON for the NEW or MODIFIED report.
- If the user's request is vague, ask for clarification.
""";

        var chatHistory = new StringBuilder();
        if (history != null && history.Any())
        {
            chatHistory.AppendLine("CHAT HISTORY:");
            foreach (var msg in history)
            {
                chatHistory.AppendLine($"{msg.Role.ToUpper()}: {msg.Content}");
            }
            chatHistory.AppendLine();
        }

        var generatedText = await CallAiAsync(apiKey, systemPrompt, $"{chatHistory}User Request: {userPrompt}");

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try 
        {
            return JsonSerializer.Deserialize<AiGenerationResponseDto>(generatedText, options) ?? new AiGenerationResponseDto { NeedsMoreInfo = true, Message = "Failed to deserialize response" };
        }
        catch (JsonException ex)
        {
             throw new InvalidOperationException($"Failed to parse AI response as JSON. Response: {generatedText}", ex);
        }
    }

    public async Task<AiGenerationResponseDto> GenerateApiConfigAsync(int moduleId, string userPrompt, List<AiChatMessageDto> history)
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

        var existingConfigs = await _context.ExternalApiConfigs
            .Where(c => c.ModuleId == moduleId)
            .ToListAsync();

        var currentConfig = new
        {
            Module = new
            {
                module.Name,
                module.KanbanField,
                Fields = module.Fields.Select(f => new
                {
                    f.Name,
                    f.Label,
                    f.Type,
                    f.Options
                })
            },
            ExistingApiConfigs = existingConfigs.Select(c => new
            {
                c.Name,
                c.Url,
                c.Method,
                c.HeadersJson,
                c.RequestBodyTemplate,
                c.ResponseMappingsJson
            })
        };

        var currentConfigJson = JsonSerializer.Serialize(currentConfig, new JsonSerializerOptions { WriteIndented = true });

        var systemPrompt = $$$$"""
You are an AI API integration specialist. Your goal is to generate External API Configuration for a specific module in a business system.
The output MUST be a valid JSON object matching the following structure exactly. Do not include markdown code blocks (```json ... ```), just return the raw JSON.

Structure:
{
  "NeedsMoreInfo": false,
  "Message": "If NeedsMoreInfo is true, ask your clarification question here (in the user's language). If false, provide a brief success message.",
  "Configuration": {
    "ApiConfigs": [
      {
        "ModuleName": "{{{{module.Name}}}}",
        "Name": "Config Name",
        "Url": "https://api.example.com/v1/{{FieldName}}",
        "Method": "GET|POST|PUT|DELETE",
        "HeadersJson": "{\"Authorization\": \"Bearer ...\", \"Content-Type\": \"application/json\"}",
        "RequestBodyTemplate": "{\"id\": {{Id}}, \"action\": \"verify\"}",
        "ResponseMappingsJson": "{\"__root__\": \"data\", \"subead\": \"ŞubeAdı\", \"subeadres\": \"Adres\", \"subetel\": \"Telefon\", \"subemail\": \"Email\"}"
      }
    ]
  }
}

Rules:
1. Use the fields available in the provided module for dynamic placeholders.
2. Use {{FieldName}} syntax in Url, HeadersJson, and RequestBodyTemplate for dynamic values from records.
 3. ResponseMappingsJson maps JSON paths from API response to module field names. Key = JSON path in response (e.g. "result.id" or "__root__" for base data path), Value = Module field name to update.
    Example for branch data: {"__root__": "data", "subead": "ŞubeAdı", "subeadres": "Adres", "subetel": "Telefon", "subemail": "Email"}
4. HeadersJson should be a valid JSON string representing HTTP headers.
5. RequestBodyTemplate should be a valid JSON template string with {{FieldName}} placeholders.
6. Try to avoid duplicating existing API configurations unless asked to modify them.
7. Choose the most appropriate HTTP method for the integration type.
8. Provide realistic, production-ready configurations based on common API patterns.
9. IMPORTANT: Review the chat history carefully! If the user's intent is unclear or lacks details, set NeedsMoreInfo to true and ask questions in Message. If sufficient, set to false and provide Configuration. If NeedsMoreInfo is true, Configuration must be null or omitted.

MODULE STRUCTURE:
{{{{currentConfigJson}}}}

IMPORTANT:
- Return ONLY the JSON for the NEW API configuration(s).
- If the user's request is vague, generate a sensible API integration configuration based on the module's fields and purpose, OR ask for clarification if strictly necessary.
- Generate only ONE ApiConfig entry unless the user explicitly asks for multiple.
""";

        var chatHistory = new StringBuilder();
        if (history != null && history.Any())
        {
            chatHistory.AppendLine("CHAT HISTORY:");
            foreach (var msg in history)
            {
                chatHistory.AppendLine($"{msg.Role.ToUpper()}: {msg.Content}");
            }
            chatHistory.AppendLine();
        }

        var generatedText = await CallAiAsync(apiKey, systemPrompt, $"{chatHistory}User Request: {userPrompt}");

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try 
        {
            return JsonSerializer.Deserialize<AiGenerationResponseDto>(generatedText, options) ?? new AiGenerationResponseDto { NeedsMoreInfo = true, Message = "Failed to deserialize response" };
        }
        catch (JsonException ex)
        {
             throw new InvalidOperationException($"Failed to parse AI response as JSON. Response: {generatedText}", ex);
        }
    }

    public async Task<AiGenerationResponseDto> GenerateScriptConfigAsync(int moduleId, string userPrompt, List<AiChatMessageDto> history)
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

        var existingScripts = await _context.ModuleScripts
            .Where(s => s.ModuleId == moduleId)
            .ToListAsync();

        var currentConfig = new
        {
            Module = new
            {
                module.Name,
                module.KanbanField,
                Fields = module.Fields.Select(f => new
                {
                    f.Name,
                    f.Label,
                    f.Type,
                    f.Options
                })
            },
            ExistingScripts = existingScripts.Select(s => new
            {
                s.TriggerType,
                s.ScriptContent,
                s.IsActive
            })
        };

        var currentConfigJson = JsonSerializer.Serialize(currentConfig, new JsonSerializerOptions { WriteIndented = true });

        var systemPrompt = $$$$"""
You are an AI Scripting specialist for a business system that uses a built-in V8 JavaScript engine for automation and validation.
Your goal is to generate Module Scripts for a specific module.
The output MUST be a valid JSON object matching the following structure exactly. Do not include markdown code blocks (```json ... ```), just return the raw JSON.

Structure:
{
  "NeedsMoreInfo": false,
  "Message": "If NeedsMoreInfo is true, ask your clarification question here (in the user's language). If false, provide a brief success message.",
  "Configuration": {
    "Scripts": [
      {
        "ModuleName": "{{{{module.Name}}}}",
        "TriggerType": "BeforeCreate|AfterCreate|BeforeUpdate|AfterUpdate|BeforeDelete|AfterDelete|CustomList",
        "ScriptContent": "// JS code. Available: Db, Data, User, Fail(msg), Log(msg)",
        "IsActive": true
      }
    ]
  }
}

Scripting Context:
- Language: JavaScript (V8 Engine)
- Available Global Objects:
  - Db: Access to database operations (e.g. Db.GetRecord, Db.UpdateRecord)
  - Data: The current record being processed. Properties match module field names.
  - User: Context of the current user (Id, Username, Email, Roles).
  - Fail(message): Call this to abort the operation and show an error to the user. (Typically used in 'Before' triggers for validation).
  - Log(message): Call this to write to system logs for debugging.

Trigger Types:
- BeforeCreate/Update/Delete: Runs BEFORE the database operation. Use Fail(msg) for validation.
- AfterCreate/Update/Delete: Runs AFTER the database operation. Use for side effects like logging, notifications, or updating other records.
- CustomList: Used for custom logic when listing records (e.g. filtering).

Rules:
1. Use the fields available in the provided module.
2. In 'Before' scripts, always check for conditions and call Fail("ErrorMessage") if validation fails.
3. In 'After' scripts, focus on business logic and side effects.
4. Try to avoid duplicating existing scripts unless asked to modify them.
5. Provide clean, well-commented, and robust JavaScript code.
6. Generate only ONE Script entry unless the user explicitly asks for multiple.
7. IMPORTANT: Review the chat history carefully! If the user's intent is unclear or lacks details, set NeedsMoreInfo to true and ask questions in Message. If sufficient, set to false and provide Configuration. If NeedsMoreInfo is true, Configuration must be null or omitted.

MODULE STRUCTURE & EXISTING SCRIPTS:
{{{{currentConfigJson}}}}

IMPORTANT:
- Return ONLY the JSON for the NEW script configuration.
- If the user's request is vague, ask for clarification.
""";

        var chatHistory = new StringBuilder();
        if (history != null && history.Any())
        {
            chatHistory.AppendLine("CHAT HISTORY:");
            foreach (var msg in history)
            {
                chatHistory.AppendLine($"{msg.Role.ToUpper()}: {msg.Content}");
            }
            chatHistory.AppendLine();
        }

        var generatedText = await CallAiAsync(apiKey, systemPrompt, $"{chatHistory}User Request: {userPrompt}");

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try 
        {
            return JsonSerializer.Deserialize<AiGenerationResponseDto>(generatedText, options) ?? new AiGenerationResponseDto { NeedsMoreInfo = true, Message = "Failed to deserialize response" };
        }
        catch (JsonException ex)
        {
             throw new InvalidOperationException($"Failed to parse AI response as JSON. Response: {generatedText}", ex);
        }
    }

    public async Task<AiGenerationResponseDto> GenerateVisibilityRuleConfigAsync(int moduleId, string userPrompt, List<AiChatMessageDto> history)
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

        var existingRoles = await _context.Roles.Where(r => r.TenantId == tenantId).ToListAsync();
        
        var existingRules = await _context.ModuleVisibilityRules
            .Include(r => r.Role)
            .Where(r => r.ModuleId == moduleId && r.TenantId == tenantId)
            .ToListAsync();

        var currentConfig = new
        {
            Module = new
            {
                module.Name,
                module.KanbanField,
                Fields = module.Fields.Select(f => new
                {
                    f.Name,
                    f.Label,
                    f.Type
                })
            },
            Roles = existingRoles.Select(r => r.Name),
            ExistingRules = existingRules.Select(r => new
            {
                RoleName = r.Role?.Name,
                r.Field,
                r.Operator,
                r.Value,
                r.Action,
                r.IsActive
            })
        };

        var currentConfigJson = JsonSerializer.Serialize(currentConfig, new JsonSerializerOptions { WriteIndented = true });

        var systemPrompt = $$$$"""
You are an AI access control specialist. Your goal is to generate Module Visibility Rules for Row-Level Security.
The output MUST be a valid JSON object matching the following structure exactly. Do not include markdown code blocks (```json ... ```), just return the raw JSON.

Structure:
{
  "NeedsMoreInfo": false,
  "Message": "If NeedsMoreInfo is true, ask your clarification question here (in the user's language). If false, provide a brief success message.",
  "Configuration": {
    "VisibilityRules": [
      {
        "ModuleName": "{{{{module.Name}}}}",
        "RoleName": "Admin", // Optional. Can be null or omitted to apply to all roles.
        "Field": "__createdByUserId", // e.g., __createdByUserId or a custom field name
        "Operator": "eq|neq|contains|gt|lt",
        "Value": "{{CurrentUser.Id}}", // Use {{CurrentUser.Id}} for dynamic user matching, or static values
        "Action": "Show|Hide",
        "IsActive": true
      }
    ]
  }
}

Rules:
1. Use the fields available in the provided module. The special field '__createdByUserId' is always available for matching the record's creator.
2. Operator must be one of: eq (equals), neq (not equals), contains, gt (greater than), lt (less than).
3. Action must be 'Show' or 'Hide'.
4. If the rule should only apply to a specific role, set 'RoleName' to one of the provided roles. If it should apply to everyone, omit 'RoleName' or set it to null.
5. If the user wants to filter by "their own records", set Field: "__createdByUserId", Operator: "eq", Value: "{{CurrentUser.Id}}", Action: "Show".
6. If the user wants to hide other's records, set Field: "__createdByUserId", Operator: "neq", Value: "{{CurrentUser.Id}}", Action: "Hide".
7. IMPORTANT: Review the chat history carefully! If the user's intent is unclear or lacks details, set NeedsMoreInfo to true and ask questions in Message. If sufficient, set to false and provide Configuration. If NeedsMoreInfo is true, Configuration must be null or omitted.

MODULE STRUCTURE, ROLES & EXISTING RULES:
{{{{currentConfigJson}}}}

IMPORTANT:
- Return ONLY the JSON for the NEW visibility rule configuration(s).
- If the user's request is vague, ask for clarification.
""";

        var chatHistory = new StringBuilder();
        if (history != null && history.Any())
        {
            chatHistory.AppendLine("CHAT HISTORY:");
            foreach (var msg in history)
            {
                chatHistory.AppendLine($"{msg.Role.ToUpper()}: {msg.Content}");
            }
            chatHistory.AppendLine();
        }

        var generatedText = await CallAiAsync(apiKey, systemPrompt, $"{chatHistory}User Request: {userPrompt}");

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try 
        {
            return JsonSerializer.Deserialize<AiGenerationResponseDto>(generatedText, options) ?? new AiGenerationResponseDto { NeedsMoreInfo = true, Message = "Failed to deserialize response" };
        }
        catch (JsonException ex)
        {
             throw new InvalidOperationException($"Failed to parse AI response as JSON. Response: {generatedText}", ex);
        }
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
