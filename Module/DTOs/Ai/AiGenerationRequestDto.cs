namespace Module.DTOs.Ai;

public class AiGenerationRequestDto
{
    public string Prompt { get; set; } = string.Empty;
    public List<AiChatMessageDto> History { get; set; } = new();
}
