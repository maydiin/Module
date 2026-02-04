namespace Module.Entities;

public class ModuleField
{
    public int Id { get; set; }
    public int ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // text, number, date, checkbox
    public bool Required { get; set; }
    public string? Options { get; set; } // JSON array of options
    public int OrderNo { get; set; }
    
    public Module Module { get; set; } = null!;
}

