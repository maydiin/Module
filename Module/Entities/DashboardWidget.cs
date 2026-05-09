using System.ComponentModel.DataAnnotations;

namespace Module.Entities;

public class DashboardWidget
{
    public int Id { get; set; }

    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    // stat_card | bar_chart | pie_chart | line_chart | recent_records
    [Required]
    [MaxLength(50)]
    public string WidgetType { get; set; } = "stat_card";

    [Required]
    public string Configuration { get; set; } = "{}"; // JSON

    public int ColSpan { get; set; } = 1; // 1=small, 2=medium, 3=large (out of 3 columns)

    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
