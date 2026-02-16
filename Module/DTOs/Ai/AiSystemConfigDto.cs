namespace Module.DTOs.Ai;

public class AiSystemConfigDto
{
    public List<AiModuleConfigDto> Modules { get; set; } = new();
    public List<AiScriptConfigDto> Scripts { get; set; } = new();
    public List<AiApiConfigDto> ApiConfigs { get; set; } = new();
    public List<AiReportConfigDto> Reports { get; set; } = new();
}

public class AiModuleConfigDto
{
    public string Name { get; set; } = string.Empty;
    public bool AuditCreate { get; set; } = true;
    public bool AuditUpdate { get; set; } = true;
    public bool AuditDelete { get; set; } = true;
    public List<AiModuleFieldConfigDto> Fields { get; set; } = new();
}

public class AiModuleFieldConfigDto
{
    public string Name { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Required { get; set; }
    public string? Options { get; set; } // JSON array or target module name
    public int OrderNo { get; set; }
}

public class AiScriptConfigDto
{
    public string ModuleName { get; set; } = string.Empty;
    public string TriggerType { get; set; } = string.Empty;
    public string ScriptContent { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class AiApiConfigDto
{
    public string ModuleName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "POST";
    public string? HeadersJson { get; set; }
    public string? RequestBodyTemplate { get; set; }
    public string? ResponseMappingsJson { get; set; }
}

public class AiReportConfigDto
{
    public string ModuleName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "List"; // List, Chart, Pivot
    public string Configuration { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
}
