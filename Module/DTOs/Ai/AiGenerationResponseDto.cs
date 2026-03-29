namespace Module.DTOs.Ai;

public class AiGenerationResponseDto
{
    public bool NeedsMoreInfo { get; set; }
    public string Message { get; set; } = string.Empty;
    public AiSystemConfigDto? Configuration { get; set; }
}
