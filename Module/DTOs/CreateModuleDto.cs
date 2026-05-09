namespace Module.DTOs;

public class CreateModuleDto
{
    public string Name { get; set; } = string.Empty;
    
    public bool AuditCreate { get; set; } = true;
    public bool AuditUpdate { get; set; } = true;
    public bool AuditDelete { get; set; } = true;
    public string? KanbanField { get; set; }
}

