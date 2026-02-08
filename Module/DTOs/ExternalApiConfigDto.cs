namespace Module.DTOs;

public class ExternalApiConfigDto
{
    public int Id { get; set; }
    public int ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "POST";
    public string? HeadersJson { get; set; }
    public string? RequestBodyTemplate { get; set; }
    public string? ResponseMappingsJson { get; set; }
}

public class CreateExternalApiConfigDto
{
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "POST";
    public string? HeadersJson { get; set; }
    public string? RequestBodyTemplate { get; set; }
    public string? ResponseMappingsJson { get; set; }
}

public class UpdateExternalApiConfigDto
{
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "POST";
    public string? HeadersJson { get; set; }
    public string? RequestBodyTemplate { get; set; }
    public string? ResponseMappingsJson { get; set; }
}
