namespace Module.DTOs.Ai;

public class AiQueryRequestDto
{
    public int ModuleId { get; set; }
    public string Prompt { get; set; } = string.Empty;
}

public class AiQueryResponseDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public List<RecordFilterDto>? Filters { get; set; }
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
}
