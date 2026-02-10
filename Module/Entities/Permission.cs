namespace Module.Entities;

public class Permission
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // e.g., "Module.Kurum.View"
    public string Description { get; set; } = string.Empty;
    
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
