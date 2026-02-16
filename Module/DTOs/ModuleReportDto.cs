namespace Module.DTOs;

public class ModuleReportDto
{
    public int Id { get; set; }
    public int ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "List";
    public string Configuration { get; set; } = "{}";
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateModuleReportDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "List";
    public string Configuration { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
}

public class UpdateModuleReportDto
{
    public string? Name { get; set; }
    public string? Type { get; set; }
    public string? Configuration { get; set; }
    public bool? IsActive { get; set; }
}
