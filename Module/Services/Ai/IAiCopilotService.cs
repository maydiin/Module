using Module.DTOs.Ai;

namespace Module.Services.Ai;

public interface IAiCopilotService
{
    Task<CopilotResponseDto> ProcessChatAsync(CopilotRequestDto request);
}
