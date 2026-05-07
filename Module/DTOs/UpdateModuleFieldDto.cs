namespace Module.DTOs;

public class UpdateModuleFieldDto
{
    public string? Label { get; set; }
    public bool Required { get; set; }
    public string? Options { get; set; }
    public int OrderNo { get; set; }
    public bool IsStored { get; set; } = true;
    public bool IsDisplayField { get; set; }
}
