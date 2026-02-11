namespace Module.Entities;

public class Module
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    
    // Multi-tenant support
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    
    public ICollection<ModuleField> Fields { get; set; } = new List<ModuleField>();
    public ICollection<ModuleRecord> Records { get; set; } = new List<ModuleRecord>();
}

