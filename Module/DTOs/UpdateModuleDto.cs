namespace Module.DTOs;

public class UpdateModuleDto
{
    public string Name { get; set; } = string.Empty;
    public bool AuditCreate { get; set; }
    public bool AuditUpdate { get; set; }
    public bool AuditDelete { get; set; }
    public string? KanbanField { get; set; }
}
