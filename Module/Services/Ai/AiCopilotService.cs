using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs.Ai;
using Module.Entities;
using Module.Services;

namespace Module.Services.Ai;

public class AiCopilotService : IAiCopilotService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IAiModuleSetupService _setupService;
    private readonly IModuleService _moduleService;
    private readonly ILogger<AiCopilotService> _logger;

    public AiCopilotService(
        HttpClient httpClient,
        IConfiguration configuration,
        AppDbContext context,
        ITenantService tenantService,
        IAiModuleSetupService setupService,
        IModuleService moduleService,
        ILogger<AiCopilotService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _context = context;
        _tenantService = tenantService;
        _setupService = setupService;
        _moduleService = moduleService;
        _logger = logger;
    }

    public async Task<CopilotResponseDto> ProcessChatAsync(CopilotRequestDto request)
    {
        var apiKey = _configuration["Ai:ApiKey"] ?? _configuration["Gemini:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("AI API Key is not configured.");

        var tenantId = _tenantService.GetCurrentTenantId();

        // ── If user confirmed a previous action, execute it ──
        if (request.PendingActionConfirmed == true && !string.IsNullOrEmpty(request.PendingActionType))
        {
            return await ExecuteConfirmedActionAsync(request.PendingActionType, request.PendingActionPayload, tenantId);
        }

        // ── Build system context ──
        var existingModules = await _context.Modules
            .Where(m => m.TenantId == tenantId)
            .Include(m => m.Fields)
            .ToListAsync();

        var modulesCtx = existingModules.Select(m => new
        {
            m.Id,
            m.Name,
            Fields = m.Fields.Select(f => new { f.Name, f.Label, f.Type, f.Required, f.Options })
        });

        var contextJson = JsonSerializer.Serialize(modulesCtx, new JsonSerializerOptions { WriteIndented = false });

        // ── System prompt ──
        var systemPrompt = $$$"""
You are an AI Copilot for a dynamic No-Code business platform. You help users manage modules, records, reports, and more through natural language.

RULES:
1. Always reply in the same language the user writes in.
2. If the user's request is missing critical information, ask for it. Do NOT guess important data.
3. For any action that modifies the system (creating modules, adding/deleting records), you MUST set RequiresConfirmation to true and explain what you will do.
4. For read-only questions (queries, explanations), just answer directly with RequiresConfirmation = false.
5. Keep your responses concise and helpful.

AVAILABLE MODULES AND FIELDS:
{{{contextJson}}}

ACTION TYPES:
- "CreateModule": Create a new module with fields. ActionPayloadJson must be a JSON matching AiSystemConfigDto format with Modules array.
- "AddRecord": Insert a record into a module. ActionPayloadJson = {"ModuleName":"X", "Data":{"field1":"val1","field2":"val2"}}
- "DeleteRecord": Delete a record. ActionPayloadJson = {"ModuleName":"X", "RecordId": 123}
- "QueryRecords": Search/filter records. ActionPayloadJson = {"ModuleName":"X", "Filters":[{"Field":"f","Operator":"contains","Value":"v"}], "SortBy":"field", "SortDir":"desc", "Limit":10}
- "CreateReport": Create a report. ActionPayloadJson must follow report config format with ModuleName, Name, Type, Configuration.
- "None": No action needed, just a conversational reply.

RESPONSE FORMAT (strict JSON):
{
  "Text": "Your message to the user",
  "RequiresConfirmation": false,
  "ActionType": "None",
  "ActionPayloadJson": null
}
""";

        var chatHistoryStr = BuildChatHistory(request.History);
        var fullPrompt = $"{chatHistoryStr}\nuser: {request.Message}";

        var generatedText = await CallAiAsync(apiKey, systemPrompt, fullPrompt);

        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var response = JsonSerializer.Deserialize<CopilotResponseDto>(generatedText, options);

            if (response == null)
                return new CopilotResponseDto { Text = "I couldn't process that request." };

            // If AI decided to query records directly (no confirmation needed), execute inline
            if (response.ActionType == "QueryRecords" && !response.RequiresConfirmation
                && !string.IsNullOrEmpty(response.ActionPayloadJson))
            {
                var queryResult = await ExecuteQueryAsync(response.ActionPayloadJson, tenantId);
                response.Text += "\n\n" + queryResult;
                response.ActionType = "None";
                response.ActionPayloadJson = null;
            }

            return response;
        }
        catch (JsonException)
        {
            return new CopilotResponseDto
            {
                Text = generatedText,
                RequiresConfirmation = false,
                ActionType = "None"
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACTION EXECUTION
    // ═══════════════════════════════════════════════════════════════

    private async Task<CopilotResponseDto> ExecuteConfirmedActionAsync(string actionType, string? payloadJson, int? tenantId)
    {
        if (string.IsNullOrEmpty(payloadJson))
            return new CopilotResponseDto { Text = "No action payload provided." };

        try
        {
            switch (actionType)
            {
                case "CreateModule":
                    return await ExecuteCreateModuleAsync(payloadJson);
                case "AddRecord":
                    return await ExecuteAddRecordAsync(payloadJson, tenantId);
                case "DeleteRecord":
                    return await ExecuteDeleteRecordAsync(payloadJson, tenantId);
                case "CreateReport":
                    return await ExecuteCreateReportAsync(payloadJson, tenantId);
                default:
                    return new CopilotResponseDto { Text = $"Unknown action type: {actionType}" };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing copilot action {ActionType}", actionType);
            return new CopilotResponseDto { Text = $"❌ İşlem sırasında bir hata oluştu: {ex.Message}" };
        }
    }

    private async Task<CopilotResponseDto> ExecuteCreateModuleAsync(string payloadJson)
    {
        payloadJson = CleanJsonPayload(payloadJson);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        AiSystemConfigDto? config;

        if (payloadJson.StartsWith("["))
        {
            var modules = JsonSerializer.Deserialize<List<AiModuleConfigDto>>(payloadJson, options);
            config = new AiSystemConfigDto { Modules = modules ?? new() };
        }
        else
        {
            config = JsonSerializer.Deserialize<AiSystemConfigDto>(payloadJson, options);
        }
        
        if (config == null)
            return new CopilotResponseDto { Text = "❌ Modül konfigürasyonu okunamadı." };

        await _setupService.ApplyConfigAsync(config);

        var moduleNames = string.Join(", ", config.Modules.Select(m => m.Name));
        return new CopilotResponseDto
        {
            Text = $"✅ Başarılı! Aşağıdaki modüller oluşturuldu/güncellendi: **{moduleNames}**. Sol menüden erişebilirsiniz."
        };
    }

    private async Task<CopilotResponseDto> ExecuteAddRecordAsync(string payloadJson, int? tenantId)
    {
        payloadJson = CleanJsonPayload(payloadJson);
        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;

        var moduleName = root.GetProperty("ModuleName").GetString();
        var dataElement = root.GetProperty("Data");

        var module = await _context.Modules
            .Include(m => m.Fields)
            .FirstOrDefaultAsync(m => m.Name == moduleName && m.TenantId == tenantId);

        if (module == null)
            return new CopilotResponseDto { Text = $"❌ '{moduleName}' adında bir modül bulunamadı." };

        // Convert JSON data to Dictionary
        var data = new Dictionary<string, object>();
        foreach (var prop in dataElement.EnumerateObject())
        {
            data[prop.Name] = prop.Value.ValueKind switch
            {
                JsonValueKind.Number => prop.Value.GetDecimal(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => prop.Value.GetString() ?? ""
            };
        }

        // Compute formulas if any
        data = _moduleService.ComputeFormulas(module, data);

        var record = new ModuleRecord
        {
            ModuleId = module.Id,
            Data = _moduleService.SerializeData(data),
            CreatedAt = DateTime.UtcNow
        };

        _context.ModuleRecords.Add(record);
        await _context.SaveChangesAsync();

        return new CopilotResponseDto
        {
            Text = $"✅ Kayıt başarıyla eklendi! (Modül: **{moduleName}**, Kayıt ID: **{record.Id}**)"
        };
    }

    private async Task<CopilotResponseDto> ExecuteDeleteRecordAsync(string payloadJson, int? tenantId)
    {
        payloadJson = CleanJsonPayload(payloadJson);
        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;

        var moduleName = root.GetProperty("ModuleName").GetString();
        var recordId = root.GetProperty("RecordId").GetInt32();

        var module = await _context.Modules
            .FirstOrDefaultAsync(m => m.Name == moduleName && m.TenantId == tenantId);

        if (module == null)
            return new CopilotResponseDto { Text = $"❌ '{moduleName}' adında bir modül bulunamadı." };

        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == recordId && r.ModuleId == module.Id);

        if (record == null)
            return new CopilotResponseDto { Text = $"❌ Kayıt ID {recordId} bulunamadı." };

        _context.ModuleRecords.Remove(record);
        await _context.SaveChangesAsync();

        return new CopilotResponseDto
        {
            Text = $"✅ Kayıt silindi! (Modül: **{moduleName}**, Kayıt ID: **{recordId}**)"
        };
    }

    private async Task<CopilotResponseDto> ExecuteCreateReportAsync(string payloadJson, int? tenantId)
    {
        payloadJson = CleanJsonPayload(payloadJson);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;

        var moduleName = root.GetProperty("ModuleName").GetString();
        var module = await _context.Modules
            .FirstOrDefaultAsync(m => m.Name == moduleName && m.TenantId == tenantId);

        if (module == null)
            return new CopilotResponseDto { Text = $"❌ '{moduleName}' adında bir modül bulunamadı." };

        var reportName = root.GetProperty("Name").GetString() ?? "AI Report";
        var reportType = root.GetProperty("Type").GetString() ?? "List";
        var configuration = root.TryGetProperty("Configuration", out var configEl)
            ? configEl.GetRawText()
            : "{}";

        var report = new ModuleReport
        {
            ModuleId = module.Id,
            TenantId = tenantId ?? 0,
            Name = reportName,
            Type = reportType,
            Configuration = configuration,
            IsActive = true
        };

        _context.ModuleReports.Add(report);
        await _context.SaveChangesAsync();

        return new CopilotResponseDto
        {
            Text = $"✅ Rapor oluşturuldu! (Modül: **{moduleName}**, Rapor: **{reportName}**, Tip: **{reportType}**)"
        };
    }

    private async Task<string> ExecuteQueryAsync(string payloadJson, int? tenantId)
    {
        try
        {
            payloadJson = CleanJsonPayload(payloadJson);
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;

            var moduleName = root.GetProperty("ModuleName").GetString();
            var module = await _context.Modules
                .Include(m => m.Fields)
                .FirstOrDefaultAsync(m => m.Name == moduleName && m.TenantId == tenantId);

            if (module == null)
                return $"'{moduleName}' adında bir modül bulunamadı.";

            var query = _context.ModuleRecords.Where(r => r.ModuleId == module.Id);

            // Apply sorting
            if (root.TryGetProperty("SortDir", out var sortDirEl) && sortDirEl.GetString() == "asc")
                query = query.OrderBy(r => r.Id);
            else
                query = query.OrderByDescending(r => r.Id);

            // Apply limit
            var limit = 10;
            if (root.TryGetProperty("Limit", out var limitEl))
                limit = limitEl.GetInt32();

            var records = await query.Take(limit).ToListAsync();

            if (!records.Any())
                return "Bu kriterlere uygun kayıt bulunamadı.";

            // Format results as a simple text table
            var displayFields = module.Fields
                .Where(f => f.IsDisplayField)
                .Select(f => f.Name)
                .ToList();

            if (!displayFields.Any())
                displayFields = module.Fields.Take(4).Select(f => f.Name).ToList();

            var lines = new List<string> { $"📊 **{moduleName}** — {records.Count} kayıt bulundu:\n" };
            foreach (var rec in records)
            {
                var data = _moduleService.DeserializeData(rec.Data);
                var values = displayFields
                    .Where(f => data.ContainsKey(f))
                    .Select(f => $"**{f}**: {data[f]}")
                    .ToList();
                lines.Add($"• ID {rec.Id} — {string.Join(" | ", values)}");
            }

            return string.Join("\n", lines);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Copilot query execution failed");
            return "Sorgu çalıştırılırken bir hata oluştu.";
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════

    private static string CleanJsonPayload(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return string.Empty;
        var cleaned = payload.Trim();
        if (cleaned.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            cleaned = cleaned.Substring(7);
        }
        else if (cleaned.StartsWith("```"))
        {
            cleaned = cleaned.Substring(3);
        }
        if (cleaned.EndsWith("```"))
        {
            cleaned = cleaned.Substring(0, cleaned.Length - 3);
        }
        return cleaned.Trim();
    }

    private static string BuildChatHistory(List<CopilotChatMessageDto> history)
    {
        if (history == null || !history.Any()) return "";

        return string.Join("\n", history.Select(h => $"{h.Role}: {h.Content}"));
    }

    // ═══════════════════════════════════════════════════════════════
    //  AI API CALLS
    // ═══════════════════════════════════════════════════════════════

    private async Task<string> CallAiAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var provider = _configuration["Ai:Provider"]?.ToLowerInvariant() ?? "gemini";

        if (provider == "openai")
            return await CallOpenAiAsync(apiKey, systemPrompt, userMessage);
        else
            return await CallGeminiAsync(apiKey, systemPrompt, userMessage);
    }

    private async Task<string> CallOpenAiAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var baseUrl = _configuration["Ai:BaseUrl"];
        if (string.IsNullOrEmpty(baseUrl)) throw new InvalidOperationException("AI BaseUrl missing.");

        var model = _configuration["Ai:Model"] ?? "gpt-3.5-turbo";
        var apiUrl = baseUrl.TrimEnd('/') + "/chat/completions";

        var requestBody = new
        {
            model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage }
            },
            response_format = new { type = "json_object" }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), System.Text.Encoding.UTF8, "application/json");

        using var requestMessage = new HttpRequestMessage(HttpMethod.Post, apiUrl) { Content = jsonContent };
        requestMessage.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await _httpClient.SendAsync(requestMessage);
        var responseString = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception($"OpenAI API error: {responseString}");

        var jsonDoc = JsonDocument.Parse(responseString);
        return jsonDoc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "{}";
    }

    private async Task<string> CallGeminiAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var model = _configuration["Ai:Model"] ?? "gemini-2.0-flash";
        var apiUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var requestBody = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = userMessage } } } },
            generationConfig = new { response_mime_type = "application/json" }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), System.Text.Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(apiUrl, jsonContent);
        var responseString = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception($"Gemini API error: {responseString}");

        var jsonDoc = JsonDocument.Parse(responseString);
        var candidates = jsonDoc.RootElement.GetProperty("candidates");
        if (candidates.GetArrayLength() > 0)
            return candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? "{}";

        return "{}";
    }
}
