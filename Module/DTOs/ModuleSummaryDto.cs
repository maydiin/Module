using System;
using System.Collections.Generic;

namespace Module.DTOs;

public class ModuleSummaryDto
{
    public int ModuleId { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    public string? KanbanField { get; set; }
    public string? LayoutConfig { get; set; }
    public bool AuditCreate { get; set; }
    public bool AuditUpdate { get; set; }
    public bool AuditDelete { get; set; }
    public List<ModuleFieldDto> Fields { get; set; } = new();
    public List<ModuleRecordDto> LatestRecords { get; set; } = new();
}
