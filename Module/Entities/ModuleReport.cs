using System.ComponentModel.DataAnnotations;

namespace Module.Entities;

public class ModuleReport : IMustHaveTenant
{
    public int Id { get; set; }
    
    public int ModuleId { get; set; }
    public Module Module { get; set; } = null!;
    
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = "List"; // List, Chart, Pivot

    [Required]
    public string Configuration { get; set; } = "{}"; // JSON config

    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
