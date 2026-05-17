using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Module.Entities;

public class ApprovalRequest
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ModuleRecordId { get; set; }

    [Required]
    public int ModuleId { get; set; }

    [Required]
    public int RequestedByUserId { get; set; }

    public int? AssignedToRoleId { get; set; }
    public int? AssignedToUserId { get; set; }

    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected

    public string? Message { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ResolvedAt { get; set; }

    public int? ResolvedByUserId { get; set; }
    
    public string? Comments { get; set; } // Approver comments

    // Multi-tenant support
    public int TenantId { get; set; }

    [ForeignKey("ModuleRecordId")]
    public ModuleRecord ModuleRecord { get; set; } = null!;

    [ForeignKey("ModuleId")]
    public Module Module { get; set; } = null!;

    [ForeignKey("RequestedByUserId")]
    public User RequestedByUser { get; set; } = null!;

    [ForeignKey("AssignedToRoleId")]
    public Role? AssignedToRole { get; set; }

    [ForeignKey("AssignedToUserId")]
    public User? AssignedToUser { get; set; }

    [ForeignKey("ResolvedByUserId")]
    public User? ResolvedByUser { get; set; }
    
    [ForeignKey("TenantId")]
    public Tenant Tenant { get; set; } = null!;
}
