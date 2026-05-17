namespace Module.Entities;

public class ModuleRecord
{
    public int Id { get; set; }
    public int ModuleId { get; set; }
    public string Data { get; set; } = string.Empty; // JSON stored as nvarchar(max)
    public DateTime CreatedAt { get; set; }
    
    // Multi-tenant support
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    
    // Creator info for ownership
    public int? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
    
    public Module Module { get; set; } = null!;
    
    // Approval Engine
    public string? ApprovalStatus { get; set; } // e.g. Draft, Pending, Approved, Rejected
}

