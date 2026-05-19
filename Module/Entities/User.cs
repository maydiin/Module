namespace Module.Entities;

public class User : IMayHaveTenant
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Email verification fields
    public string? EmailVerificationCode { get; set; }
    public DateTime? EmailVerificationCodeExpiry { get; set; }
    public bool IsEmailVerified { get; set; } = false;
    
    // Multi-tenant support
    public int? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    
    // Module linking
    public int? LinkedModuleId { get; set; }
    public Module? LinkedModule { get; set; }
    
    public int? LinkedRecordId { get; set; }
    public ModuleRecord? LinkedRecord { get; set; }
}
