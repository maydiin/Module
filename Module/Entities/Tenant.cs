namespace Module.Entities;

public class Tenant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subdomain { get; set; }
    public bool IsHost { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Module> Modules { get; set; } = new List<Module>();
    public ICollection<ModuleRecord> ModuleRecords { get; set; } = new List<ModuleRecord>();
}
