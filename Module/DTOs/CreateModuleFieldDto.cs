namespace Module.DTOs;

public class CreateModuleFieldDto
{
    public string Name { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Required { get; set; }
    public string? Options { get; set; }
    public int OrderNo { get; set; }
    public bool IsDisplayField { get; set; }
}

