using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Module.Entities;

[Table("ModuleScripts")]
public class ModuleScript
{
    [Key]
    public int Id { get; set; }

    public int? TenantId { get; set; } // Nullable: Global scripts for a module (if needed)

    [Required]
    public int ModuleId { get; set; }

    [Required]
    [MaxLength(50)]
    public string TriggerType { get; set; } = string.Empty; // "BeforeCreate", "AfterCreate", "CustomList", "BeforeUpdate", "AfterUpdate", "BeforeDelete", "AfterDelete"

    [Required]
    public string ScriptContent { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    // Navigation property
    [ForeignKey("ModuleId")]
    public Module? Module { get; set; }
}
