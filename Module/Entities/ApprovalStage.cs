using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Module.Entities;

public class ApprovalStage : IMustHaveTenant
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ApprovalRequestId { get; set; }

    [Required]
    public int StageOrder { get; set; } // 1, 2, 3...

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    public int? AssignedToRoleId { get; set; }
    public int? AssignedToUserId { get; set; }

    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Waiting"; // Pending, Waiting, Approved, Rejected, Skipped

    public string? Message { get; set; }
    public string? Comments { get; set; }

    public DateTime? ResolvedAt { get; set; }
    public int? ResolvedByUserId { get; set; }

    // Escalation & Timeout Rules
    public int? TimeoutHours { get; set; }
    
    [StringLength(50)]
    public string? EscalationAction { get; set; } // e.g. "Escalate", "AutoReject", "AutoApprove"
    
    public int? EscalateToRoleId { get; set; }
    public DateTime? EscalationDeadline { get; set; }
    public bool Escalated { get; set; } = false;

    // Multi-tenant support
    public int TenantId { get; set; }

    [ForeignKey("ApprovalRequestId")]
    public virtual ApprovalRequest ApprovalRequest { get; set; } = null!;

    [ForeignKey("AssignedToRoleId")]
    public virtual Role? AssignedToRole { get; set; }

    [ForeignKey("AssignedToUserId")]
    public virtual User? AssignedToUser { get; set; }

    [ForeignKey("EscalateToRoleId")]
    public virtual Role? EscalateToRole { get; set; }

    [ForeignKey("ResolvedByUserId")]
    public virtual User? ResolvedByUser { get; set; }

    [ForeignKey("TenantId")]
    public virtual Tenant Tenant { get; set; } = null!;
}
