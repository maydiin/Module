namespace Module.DTOs;

public class ModuleFieldDto
{
    public int Id { get; set; }
    public int ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Required { get; set; }
    public string? Options { get; set; }
    public int OrderNo { get; set; }
    public bool IsStored { get; set; } = true;
    public bool IsDisplayField { get; set; }
}

