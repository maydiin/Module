namespace Module.DTOs.Ai;

public class AiChatMessageDto
{
    public string Role { get; set; } = string.Empty; // "user" or "ai"
    public string Content { get; set; } = string.Empty;
}
