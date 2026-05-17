namespace Module.DTOs;

public class ModuleRecordDto
{
    public int Id { get; set; }
    public int ModuleId { get; set; }
    public Dictionary<string, object> Data { get; set; } = new();
    public int LinkedCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? ApprovalStatus { get; set; }
}

