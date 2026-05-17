namespace Module.Entities;

public class Module
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    
    // Audit Configuration
    public bool AuditCreate { get; set; } = true;
    public bool AuditUpdate { get; set; } = true;
    public bool AuditDelete { get; set; } = true;
    
    // Multi-tenant support
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public string? KanbanField { get; set; }
    public string? LayoutConfig { get; set; }
    
    public ICollection<ModuleField> Fields { get; set; } = new List<ModuleField>();
    public ICollection<ModuleRecord> Records { get; set; } = new List<ModuleRecord>();
    public ICollection<ModuleVisibilityRule> VisibilityRules { get; set; } = new List<ModuleVisibilityRule>();
}

