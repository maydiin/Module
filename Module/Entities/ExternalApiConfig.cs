using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Module.Entities;

public class ExternalApiConfig
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ModuleId { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Url { get; set; } = string.Empty;

    [Required]
    [StringLength(10)]
    public string Method { get; set; } = "POST";

    public string? HeadersJson { get; set; } // JSON dictionary of headers

    public string? RequestBodyTemplate { get; set; }

    public string? ResponseMappingsJson { get; set; } // JSON mapping: "api_path": "module_field_name"

    [ForeignKey("ModuleId")]
    public Module? Module { get; set; }
}
