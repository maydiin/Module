namespace Module.DTOs;

public class RecordFilterDto
{
    public string Field { get; set; } = string.Empty;
    public string Operator { get; set; } = "contains";
    public string? Value { get; set; }
    public string? ValueTo { get; set; }
}
