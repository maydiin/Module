namespace Module.Entities;

public class Permission : IMayHaveTenant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // e.g., "Module.Kurum.View"
    public string Description { get; set; } = string.Empty;
    
    // Multi-tenant support
    public int? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
