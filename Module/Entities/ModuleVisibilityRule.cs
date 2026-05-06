namespace Module.Entities;

public class ModuleVisibilityRule
{
    public int Id { get; set; }
    
    // The module this rule applies to
    public int ModuleId { get; set; }
    public Module Module { get; set; } = null!;
    
    // The role this rule applies to. If null, might apply to everyone except SuperAdmin.
    // For simplicity, let's make it so that if RoleId is specified, it only applies to users WITH that role.
    public int? RoleId { get; set; }
    public Role? Role { get; set; }
    
    public string Field { get; set; } = string.Empty; // e.g. "Status" or "__createdByUserId"
    
    public string Operator { get; set; } = "eq"; // eq, neq, contains, in, etc.
    
    public string Value { get; set; } = string.Empty; // The match value (can be {{CurrentUser.Id}})
    
    public string Action { get; set; } = "Hide"; // "Show" or "Hide"
    
    public bool IsActive { get; set; } = true;
    
    // Multi-tenant support
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
