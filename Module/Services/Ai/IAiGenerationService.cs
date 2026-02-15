using Module.DTOs.Ai;

namespace Module.Services.Ai;

public interface IAiGenerationService
{
    Task<AiSystemConfigDto> GenerateConfigAsync(string userPrompt);
}
