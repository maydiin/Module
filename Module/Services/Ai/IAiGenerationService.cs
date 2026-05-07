using Module.DTOs.Ai;

namespace Module.Services.Ai;

public interface IAiGenerationService
{
    Task<AiGenerationResponseDto> GenerateConfigAsync(string userPrompt, System.Collections.Generic.List<AiChatMessageDto> history);
    Task<AiGenerationResponseDto> GenerateReportConfigAsync(int moduleId, string userPrompt, System.Collections.Generic.List<AiChatMessageDto> history);
    Task<AiGenerationResponseDto> GenerateApiConfigAsync(int moduleId, string userPrompt, System.Collections.Generic.List<AiChatMessageDto> history);
    Task<AiGenerationResponseDto> GenerateScriptConfigAsync(int moduleId, string userPrompt, System.Collections.Generic.List<AiChatMessageDto> history);
    Task<AiGenerationResponseDto> GenerateVisibilityRuleConfigAsync(int moduleId, string userPrompt, System.Collections.Generic.List<AiChatMessageDto> history);
}
