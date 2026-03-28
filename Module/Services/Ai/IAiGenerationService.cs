using Module.DTOs.Ai;

namespace Module.Services.Ai;

public interface IAiGenerationService
{
    Task<AiSystemConfigDto> GenerateConfigAsync(string userPrompt);
    Task<AiSystemConfigDto> GenerateReportConfigAsync(int moduleId, string userPrompt);
    Task<AiSystemConfigDto> GenerateApiConfigAsync(int moduleId, string userPrompt);
    Task<AiSystemConfigDto> GenerateScriptConfigAsync(int moduleId, string userPrompt);
}
